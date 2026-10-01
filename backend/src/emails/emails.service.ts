import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { SentEmailKind, SentEmailStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const SUBJECT_PREFIX = '[Popchor Mitglieder]';
const MAX_TOTAL_ATTACHMENT_SIZE = 20 * 1024 * 1024;
const attachmentFields = { id: true, filename: true, contentType: true, size: true } as const;

export interface EmailAttachmentMetadata {
  id: string;
  filename: string;
  contentType: string;
  size: number;
}

export interface EmailArchiveEntry {
  id: string;
  subject: string;
  rawSubject: string;
  markdownContent: string;
  signatureMarkdown: string;
  sentAt: Date;
  attachments: EmailAttachmentMetadata[];
}

export interface EmailJobAcceptance {
  id: string;
  kind: SentEmailKind;
  status: SentEmailStatus;
  createdAt: Date;
}

interface RecipientSnapshot {
  to: string;
  bcc: string[];
}

@Injectable()
export class EmailsService {
  constructor(private readonly prisma: PrismaService) {}

  async listSentEmails(): Promise<EmailArchiveEntry[]> {
    const emails = await this.prisma.sentEmail.findMany({
      where: { status: SentEmailStatus.SENT, kind: SentEmailKind.BULK },
      orderBy: { sentAt: 'desc' },
      include: { attachments: { select: attachmentFields } },
    });
    return emails.map((email) => this.toArchiveEntry(email));
  }

  async getSentEmail(id: string): Promise<EmailArchiveEntry> {
    const email = await this.prisma.sentEmail.findFirst({
      where: { id, status: SentEmailStatus.SENT, kind: SentEmailKind.BULK },
      include: { attachments: { select: attachmentFields } },
    });
    if (!email) throw new NotFoundException('E-Mail nicht gefunden');
    return this.toArchiveEntry(email);
  }

  async getAttachment(emailId: string, attachmentId: string) {
    const attachment = await this.prisma.sentEmailAttachment.findFirst({
      where: {
        id: attachmentId,
        sentEmailId: emailId,
        sentEmail: { status: SentEmailStatus.SENT, kind: SentEmailKind.BULK },
      },
      select: { id: true, filename: true, contentType: true, content: true },
    });
    if (!attachment) throw new NotFoundException('Anhang nicht gefunden');
    return attachment;
  }

  async enqueueEmail(
    kind: SentEmailKind,
    subjectInput: string,
    markdownContent: string,
    signatureMarkdown: string | undefined,
    files: Express.Multer.File[],
    idempotencyKey: string,
  ): Promise<EmailJobAcceptance> {
    this.validateIdempotencyKey(idempotencyKey);
    const prepared = this.prepareEmail(subjectInput, markdownContent, signatureMarkdown, files);
    const hash = this.payloadHash(kind, prepared.subject, prepared.content, prepared.signature, prepared.attachments);

    const existing = await this.prisma.sentEmail.findUnique({ where: { idempotencyKey } });
    if (existing) return this.acceptExisting(existing, hash);

    const adminEmail = this.getAdminEmail();
    const recipients = kind === SentEmailKind.BULK
      ? await this.resolveRecipients(adminEmail)
      : { to: adminEmail, bcc: [] };

    try {
      const created = await this.prisma.sentEmail.create({
        data: {
          subject: prepared.subject,
          markdownContent: prepared.content,
          signatureMarkdown: prepared.signature,
          kind,
          idempotencyKey,
          payloadHash: hash,
          recipients: { to: recipients.to, bcc: recipients.bcc },
          status: SentEmailStatus.PENDING,
          attachments: { create: prepared.attachments },
        },
        select: { id: true, kind: true, status: true, createdAt: true },
      });
      return created;
    } catch (error) {
      // Concurrent identical submissions race on the unique idempotency index.
      const raced = await this.prisma.sentEmail.findUnique({ where: { idempotencyKey } });
      if (raced) return this.acceptExisting(raced, hash);
      throw error;
    }
  }

  async listJobs() {
    const jobs = await this.prisma.sentEmail.findMany({
      where: { idempotencyKey: { not: null } },
      orderBy: { createdAt: 'desc' },
      include: { attachments: { select: attachmentFields }, retryJob: { select: { id: true } } },
    });
    return jobs.map((job) => this.toJobDetail(job));
  }

  async getJob(id: string) {
    const job = await this.prisma.sentEmail.findUnique({
      where: { id },
      include: { attachments: { select: attachmentFields }, retryJob: { select: { id: true } } },
    });
    if (!job) throw new NotFoundException('E-Mail nicht gefunden');
    return this.toJobDetail(job);
  }

  async retryJob(id: string, idempotencyKey: string, acknowledgeDuplicateRisk = false) {
    this.validateIdempotencyKey(idempotencyKey);
    const byKey = await this.prisma.sentEmail.findUnique({ where: { idempotencyKey } });
    if (byKey) {
      if (byKey.retrySourceId !== id) throw new ConflictException('Idempotenzschlüssel bereits verwendet');
      return this.toAcceptance(byKey);
    }
    const source = await this.prisma.sentEmail.findUnique({
      where: { id },
      include: { attachments: true },
    });
    if (!source) throw new NotFoundException('E-Mail nicht gefunden');
    if (source.status !== SentEmailStatus.FAILED && source.status !== SentEmailStatus.UNKNOWN) {
      throw new ConflictException('Nur fehlgeschlagene oder unklare E-Mails können erneut gesendet werden');
    }
    if (source.status === SentEmailStatus.UNKNOWN && !acknowledgeDuplicateRisk) {
      throw new BadRequestException('Erneuter Versand kann eine doppelte E-Mail erzeugen');
    }

    const adminEmail = this.getAdminEmail();
    const recipients = source.kind === SentEmailKind.BULK
      ? await this.resolveRecipients(adminEmail)
      : { to: adminEmail, bcc: [] };
    const attachments = source.attachments.map(({ filename, contentType, size, content }) => ({
      filename, contentType, size, content,
    }));
    const hash = this.payloadHash(source.kind, source.subject, source.markdownContent, source.signatureMarkdown, attachments);
    try {
      const created = await this.prisma.sentEmail.create({
        data: {
          subject: source.subject,
          markdownContent: source.markdownContent,
          signatureMarkdown: source.signatureMarkdown,
          kind: source.kind,
          idempotencyKey,
          payloadHash: hash,
          recipients: { to: recipients.to, bcc: recipients.bcc },
          retrySourceId: id,
          status: SentEmailStatus.PENDING,
          attachments: { create: attachments },
        },
        select: { id: true, kind: true, status: true, createdAt: true },
      });
      return created;
    } catch (error) {
      const raced = await this.prisma.sentEmail.findUnique({ where: { idempotencyKey } });
      if (raced?.retrySourceId === id) return this.toAcceptance(raced);
      const retry = await this.prisma.sentEmail.findUnique({ where: { retrySourceId: id } });
      if (retry) throw new ConflictException('Für diese E-Mail wurde bereits ein erneuter Versand erstellt');
      throw error;
    }
  }

  private async resolveRecipients(adminEmail: string): Promise<RecipientSnapshot> {
    const members = await this.prisma.member.findMany({
      where: { isDisabled: false }, select: { email: true },
    });
    const seen = new Set<string>([adminEmail.toLocaleLowerCase('en-US')]);
    const bcc = members.flatMap(({ email }) => {
      const normalized = email.trim();
      const key = normalized.toLocaleLowerCase('en-US');
      if (!normalized || seen.has(key)) return [];
      seen.add(key);
      return [normalized];
    });
    return { to: adminEmail, bcc };
  }

  private prepareEmail(subjectInput: string, markdownContent: string, signatureMarkdown: string | undefined, files: Express.Multer.File[]) {
    const subject = this.normalizeSubject(subjectInput);
    if (!markdownContent?.trim()) throw new BadRequestException('Der E-Mail-Inhalt darf nicht leer sein');
    const signature = signatureMarkdown?.trim() ? signatureMarkdown : '';
    const attachmentSize = files.reduce((total, file) => total + file.size, 0);
    if (attachmentSize > MAX_TOTAL_ATTACHMENT_SIZE) throw new BadRequestException('Anhänge dürfen zusammen höchstens 20 MB groß sein');
    return {
      subject,
      content: markdownContent,
      signature,
      attachments: files.map((file) => ({
        filename: file.originalname,
        contentType: file.mimetype || 'application/octet-stream',
        size: file.size,
        content: new Uint8Array(file.buffer),
      })),
    };
  }

  private getAdminEmail(): string {
    const adminEmail = process.env.CHOIR_ADMIN_EMAIL?.trim();
    if (!adminEmail) throw new InternalServerErrorException('CHOIR_ADMIN_EMAIL ist nicht konfiguriert');
    return adminEmail;
  }

  private payloadHash(kind: SentEmailKind, subject: string, content: string, signature: string, attachments: Array<{filename:string;contentType:string;size:number;content:Uint8Array}>) {
    const hash = createHash('sha256');
    hash.update(JSON.stringify({ kind, subject, content, signature }));
    for (const file of attachments) {
      hash.update(JSON.stringify({ filename: file.filename, contentType: file.contentType, size: file.size }));
      hash.update(file.content);
    }
    return hash.digest('hex');
  }

  private validateIdempotencyKey(key: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key ?? '')) {
      throw new BadRequestException('Idempotency-Key muss eine UUID sein');
    }
  }

  private acceptExisting(email: { id: string; kind: SentEmailKind; status: SentEmailStatus; payloadHash: string | null; createdAt: Date }, hash: string) {
    if (email.payloadHash !== hash) throw new ConflictException('Idempotenzschlüssel wurde mit anderen E-Mail-Daten verwendet');
    return this.toAcceptance(email);
  }

  private toAcceptance(email: { id: string; kind: SentEmailKind; status: SentEmailStatus; createdAt: Date }): EmailJobAcceptance {
    return { id: email.id, kind: email.kind, status: email.status, createdAt: email.createdAt };
  }

  private toJobDetail(email: {
    id: string; kind: SentEmailKind; status: SentEmailStatus; createdAt: Date; sentAt: Date | null;
    subject: string; markdownContent: string; signatureMarkdown: string; failureCode: string | null;
    idempotencyKey: string | null; attachments: EmailAttachmentMetadata[]; retryJob?: { id: string } | null;
  }) {
    return {
      id: email.id,
      kind: email.kind,
      status: email.status,
      createdAt: email.createdAt,
      idempotencyKey: email.idempotencyKey,
      sentAt: email.sentAt,
      rawSubject: email.subject,
      subject: `${SUBJECT_PREFIX} ${email.subject}`,
      markdownContent: email.markdownContent,
      signatureMarkdown: email.signatureMarkdown,
      attachments: email.attachments.map(({ id, filename, contentType, size }) => ({ id, filename, contentType, size })),
      failureCode: email.failureCode,
      retryJobId: email.retryJob?.id ?? null,
    };
  }

  private normalizeSubject(value: string): string {
    const subject = value?.trim().replace(/^\[Popchor Mitglieder\]\s*/i, '');
    if (!subject) throw new BadRequestException('Der Betreff darf nicht leer sein');
    return subject;
  }

  private toArchiveEntry(email: {
    id: string; subject: string; markdownContent: string; signatureMarkdown: string;
    sentAt: Date | null; attachments: EmailAttachmentMetadata[];
  }): EmailArchiveEntry {
    if (!email.sentAt) throw new NotFoundException('E-Mail nicht gefunden');
    return {
      id: email.id,
      subject: `${SUBJECT_PREFIX} ${email.subject}`,
      rawSubject: email.subject,
      markdownContent: email.markdownContent,
      signatureMarkdown: email.signatureMarkdown,
      sentAt: email.sentAt,
      attachments: email.attachments,
    };
  }
}
