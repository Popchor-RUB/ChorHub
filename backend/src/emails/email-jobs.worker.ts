import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { SentEmailKind, SentEmailStatus } from '../generated/prisma/client';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

const HEARTBEAT_MS = 10_000;
const STALE_AFTER_MS = 5 * 60_000;

interface RecipientSnapshot {
  to: string;
  bcc: string[];
}

@Injectable()
export class EmailJobsWorker implements OnModuleDestroy {
  private readonly logger = new Logger(EmailJobsWorker.name);
  private processing = false;
  private accepting = true;

  constructor(private readonly prisma: PrismaService, private readonly mail: MailService) {}

  @Interval(1_000)
  async poll(): Promise<void> {
    if (!this.accepting || this.processing) return;
    this.processing = true;
    try {
      await this.markStaleJobsUnknown();
      const jobId = await this.claimNextJob();
      if (jobId) await this.processJob(jobId);
    } catch (error) {
      this.logger.error(`Email job polling failed: ${this.errorMessage(error)}`);
    } finally {
      this.processing = false;
    }
  }

  onModuleDestroy(): void {
    this.accepting = false;
  }

  private async markStaleJobsUnknown(): Promise<void> {
    const cutoff = new Date(Date.now() - STALE_AFTER_MS);
    const result = await this.prisma.sentEmail.updateMany({
      where: {
        status: SentEmailStatus.SENDING,
        OR: [{ heartbeatAt: { lt: cutoff } }, { heartbeatAt: null, createdAt: { lt: cutoff } }],
      },
      data: { status: SentEmailStatus.UNKNOWN, failureCode: 'DELIVERY_OUTCOME_UNKNOWN', processingToken: null },
    });
    if (result.count > 0) this.logger.warn(`Marked ${result.count} stale email job(s) as UNKNOWN`);
  }

  private async claimNextJob(): Promise<string | null> {
    const token = randomUUID();
    const claimed = await this.prisma.$queryRaw<Array<{ id: string }>>`
      UPDATE "sent_emails"
      SET "status" = 'SENDING', "processing_token" = ${token}, "heartbeat_at" = NOW()
      WHERE "id" = (
        SELECT "id" FROM "sent_emails"
        WHERE "status" = 'PENDING'
        ORDER BY "created_at" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      AND "status" = 'PENDING'
      RETURNING "id"
    `;
    if (claimed.length === 0) return null;
    this.claimTokens.set(claimed[0].id, token);
    return claimed[0].id;
  }

  private readonly claimTokens = new Map<string, string>();

  private async processJob(id: string): Promise<void> {
    const token = this.claimTokens.get(id);
    this.claimTokens.delete(id);
    if (!token) return;
    const job = await this.prisma.sentEmail.findUnique({
      where: { id },
      include: { attachments: true },
    });
    if (!job || job.status !== SentEmailStatus.SENDING || job.processingToken !== token) return;

    const startedAt = Date.now();
    this.logger.log(`Email job ${id} (${job.kind}) processing started`);
    let heartbeatRunning = false;
    const heartbeat = setInterval(() => {
      if (heartbeatRunning) return;
      heartbeatRunning = true;
      void this.prisma.sentEmail.updateMany({
        where: { id, status: SentEmailStatus.SENDING, processingToken: token },
        data: { heartbeatAt: new Date() },
      }).catch((error: unknown) => {
        this.logger.error(`Email job ${id} heartbeat failed: ${this.errorMessage(error)}`);
      }).finally(() => { heartbeatRunning = false; });
    }, HEARTBEAT_MS);

    try {
      const recipients = this.readRecipients(job.recipients);
      const bcc = job.kind === SentEmailKind.BULK
        ? await this.filterDisabledRecipients(recipients.bcc)
        : [];
      const ownership = await this.prisma.sentEmail.updateMany({
        where: { id, status: SentEmailStatus.SENDING, processingToken: token },
        data: { heartbeatAt: new Date() },
      });
      if (ownership.count !== 1) {
        this.logger.warn(`Email job ${id} lost ownership before SMTP send`);
        return;
      }
      const renderedSubject = await this.mail.sendInformationEmail({
        to: recipients.to,
        bcc,
        subject: job.subject,
        rawSubject: job.subject,
        markdownContent: job.markdownContent,
        signatureMarkdown: job.signatureMarkdown,
        attachments: job.attachments,
      });
      const persisted = await this.persistTerminalState(id, token, SentEmailStatus.SENT, null, new Date(), renderedSubject);
      if (persisted) this.logger.log(`Email job ${id} (${job.kind}) sent in ${Date.now() - startedAt}ms`);
      else this.logger.error(`Email job ${id} SMTP accepted; status remains uncertain after ${Date.now() - startedAt}ms`);
    } catch (error) {
      const explicitRejection = this.isExplicitSmtpRejection(error);
      const status = explicitRejection ? SentEmailStatus.FAILED : SentEmailStatus.UNKNOWN;
      const failureCode = explicitRejection ? 'SMTP_REJECTED' : 'DELIVERY_OUTCOME_UNKNOWN';
      this.logger.error(`Email job ${id} (${job.kind}) ${status} after ${Date.now() - startedAt}ms: ${this.errorMessage(error)}`);
      await this.persistTerminalState(id, token, status, failureCode, null);
    } finally {
      clearInterval(heartbeat);
    }
  }

  private async filterDisabledRecipients(snapshot: string[]): Promise<string[]> {
    if (snapshot.length === 0) return [];
    const current = await this.prisma.member.findMany({
      where: { isDisabled: false },
      select: { email: true },
    });
    const active = new Set(current.map(({ email }) => email.trim().toLocaleLowerCase('en-US')));
    return snapshot.filter((email) => active.has(email.trim().toLocaleLowerCase('en-US')));
  }

  private async persistTerminalState(
    id: string,
    token: string,
    status: SentEmailStatus,
    failureCode: string | null,
    sentAt: Date | null,
    renderedSubject: string | null = null,
  ): Promise<boolean> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const result = await this.prisma.sentEmail.updateMany({
          where: { id, status: SentEmailStatus.SENDING, processingToken: token },
          data: { status, failureCode, sentAt, renderedSubject, processingToken: null, heartbeatAt: null },
        });
        return result.count === 1;
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
      }
    }
    // SMTP is never retried here. A stale SENDING row becomes UNKNOWN for manual review.
    this.logger.error(`Email job ${id} terminal state persistence failed: ${this.errorMessage(lastError)}`);
    return false;
  }

  private readRecipients(value: unknown): RecipientSnapshot {
    if (typeof value !== 'object' || value === null || !('to' in value) || !('bcc' in value)) {
      throw new Error('Recipient snapshot is invalid');
    }
    const { to, bcc } = value;
    if (typeof to !== 'string' || !Array.isArray(bcc) || !bcc.every((recipient) => typeof recipient === 'string')) {
      throw new Error('Recipient snapshot is invalid');
    }
    return { to, bcc };
  }

  private isExplicitSmtpRejection(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('responseCode' in error)) return false;
    return typeof error.responseCode === 'number' && error.responseCode >= 400 && error.responseCode < 600;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
