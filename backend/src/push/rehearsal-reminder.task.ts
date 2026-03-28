import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { AttendanceResponse } from '../generated/prisma/client';
import { AuthService } from '../auth/auth.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from './push.service';

interface FallbackMailJob {
  memberId: string;
  subject: string;
  title: string;
  intro: string;
  items: { label: string; rehearsalId?: string }[];
  question?: string;
}

@Injectable()
export class RehearsalReminderTask {
  private readonly logger = new Logger(RehearsalReminderTask.name);
  private readonly mailQueue: FallbackMailJob[] = [];
  private isProcessingMailQueue = false;
  private lastFallbackMailSentAt = 0;
  private static readonly FALLBACK_MAIL_INTERVAL_MS = 60_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
    private readonly authService: AuthService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  @Cron('0 9 * * *')
  async sendDailyReminders(): Promise<void> {
    const now = new Date();
    const startOfToday = this.getUtcStartOfDay(now);
    const endExclusive = new Date(startOfToday.getTime() + 4 * 86_400_000);
    const shouldSendStalePlanReminder = this.shouldSendStalePlanReminder(now);

    const relevantRehearsals = await this.prisma.rehearsal.findMany({
      where: { date: { gte: startOfToday, lt: endExclusive }, isOptional: false },
      orderBy: { date: 'asc' },
    });

    if (relevantRehearsals.length === 0) return;

    const [members, plans] = await Promise.all([
      this.prisma.member.findMany({
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          choirVoiceId: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          pushSubscriptions: { select: { id: true } },
        },
      }),
      this.prisma.attendancePlan.findMany({
        where: { rehearsalId: { in: relevantRehearsals.map((r) => r.id) } },
        select: {
          memberId: true,
          rehearsalId: true,
          response: true,
          rehearsal: { select: { date: true, title: true } },
        },
      }),
    ]);

    const plansByMember = new Map<string, typeof plans>();
    for (const plan of plans) {
      const bucket = plansByMember.get(plan.memberId) ?? [];
      bucket.push(plan);
      plansByMember.set(plan.memberId, bucket);
    }

    for (const member of members) {
      const memberPlans = plansByMember.get(member.id) ?? [];
      const plannedRehearsalIds = new Set(memberPlans.map((p) => p.rehearsalId));
      const missingPlanRehearsals = relevantRehearsals.filter((r) => !plannedRehearsalIds.has(r.id));

      if (missingPlanRehearsals.length > 0) {
        const items = missingPlanRehearsals.map((r) => ({
          label: this.formatRehearsalLine(r.date, r.title),
          rehearsalId: r.id,
        }));
        await this.dispatchReminder(member, {
          subject: 'ChorHub Erinnerung: Anwesenheit eintragen',
          pushTitle: 'ChorHub – Anwesenheit eintragen',
          pushBody: `Bitte trage deine Anwesenheit ein:\n${items.map((item) => item.label).join('\n')}`,
          mailTitle: 'Bitte trage deine Anwesenheit ein',
          mailIntro: 'Für die folgenden Proben fehlt noch deine Anwesenheitsangabe:',
          mailItems: items,
        });
      }

      if (
        shouldSendStalePlanReminder &&
        memberPlans.length > 0 &&
        this.isStaleLogin(member.lastLoginAt, now)
      ) {
        const items = [...memberPlans]
          .sort((a, b) => a.rehearsal.date.getTime() - b.rehearsal.date.getTime())
          .map((p) => ({
            label: `${this.formatRehearsalLine(p.rehearsal.date, p.rehearsal.title)} (${this.formatResponse(p.response)})`,
          }));

        await this.dispatchReminder(member, {
          subject: 'ChorHub Erinnerung: Anwesenheitsplan prüfen',
          pushTitle: 'ChorHub – Anwesenheitsplan prüfen',
          pushBody: `Du hast geplant:\n${items.map((item) => item.label).join('\n')}\nIst das noch korrekt?`,
          mailTitle: 'Bitte prüfe deinen Anwesenheitsplan',
          mailIntro: 'Du hast für die nächsten Proben bereits Folgendes eingetragen:',
          mailItems: items,
          mailQuestion: 'Ist das noch korrekt?',
        });
      }
    }
  }

  private getUtcStartOfDay(value: Date): Date {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  private formatRehearsalLine(date: Date, title: string): string {
    const dateLabel = date.toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      timeZone: 'UTC',
    });
    return `${dateLabel} – ${title}`;
  }

  private formatResponse(response: AttendanceResponse): string {
    return response === 'CONFIRMED' ? 'Zusage' : 'Absage';
  }

  private isStaleLogin(lastLoginAt: Date | null, now: Date): boolean {
    if (!lastLoginAt) return true;
    return lastLoginAt.getTime() < now.getTime() - 14 * 86_400_000;
  }

  private shouldSendStalePlanReminder(now: Date): boolean {
    const dayNumber = Math.floor(this.getUtcStartOfDay(now).getTime() / 86_400_000);
    return dayNumber % 3 === 0;
  }

  private async dispatchReminder(
    member: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      choirVoiceId: string | null;
      lastLoginAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      pushSubscriptions: { id: string }[];
    },
    payload: {
      subject: string;
      pushTitle: string;
      pushBody: string;
      mailTitle: string;
      mailIntro: string;
      mailItems: { label: string; rehearsalId?: string }[];
      mailQuestion?: string;
    },
  ): Promise<void> {
    if (member.pushSubscriptions.length > 0) {
      await this.pushService.sendToMember(member.id, {
        title: payload.pushTitle,
        body: payload.pushBody,
        url: '/proben',
      });
      return;
    }

    this.mailQueue.push({
      memberId: member.id,
      subject: payload.subject,
      title: payload.mailTitle,
      intro: payload.mailIntro,
      items: payload.mailItems,
      question: payload.mailQuestion,
    });
    void this.processMailQueue();
  }

  private async processMailQueue(): Promise<void> {
    if (this.isProcessingMailQueue) return;
    this.isProcessingMailQueue = true;

    try {
      while (this.mailQueue.length > 0) {
        const fallbackMailIntervalMs = this.getFallbackMailIntervalMs();
        const waitMs = Math.max(
          0,
          this.lastFallbackMailSentAt + fallbackMailIntervalMs - Date.now(),
        );
        if (waitMs > 0) {
          await this.sleep(waitMs);
        }

        const next = this.mailQueue.shift();
        if (!next) continue;

        try {
          const member = await this.prisma.member.findUnique({ where: { id: next.memberId } });
          if (!member) {
            this.logger.warn(`Skipping fallback reminder mail: member ${next.memberId} not found`);
            continue;
          }

          const { magicUrl } = await this.authService.issueMemberMagicLink(member.id);
          const items = next.items.map((item) => {
            if (!item.rehearsalId) return { label: item.label };
            return {
              label: item.label,
              confirmUrl: this.buildRsvpActionUrl(magicUrl, item.rehearsalId, 'CONFIRMED'),
              declineUrl: this.buildRsvpActionUrl(magicUrl, item.rehearsalId, 'DECLINED'),
            };
          });
          const showGenericLogin = !items.some((item) => item.confirmUrl && item.declineUrl);

          await this.mailService.sendPushFallbackReminderMail({
            member,
            subject: next.subject,
            title: next.title,
            intro: next.intro,
            items,
            question: next.question,
            magicUrl,
            showGenericLogin,
          });
          this.lastFallbackMailSentAt = Date.now();
        } catch (error: unknown) {
          this.logger.warn(
            `Failed to send fallback reminder mail for member ${next.memberId}: ${String(error)}`,
          );
        }
      }
    } finally {
      this.isProcessingMailQueue = false;
      if (this.mailQueue.length > 0) {
        void this.processMailQueue();
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getFallbackMailIntervalMs(): number {
    return this.isStaging() ? 0 : RehearsalReminderTask.FALLBACK_MAIL_INTERVAL_MS;
  }

  private isStaging(): boolean {
    const raw = this.config.get<string>('IS_STAGING', 'false');
    return raw.toLowerCase() === 'true';
  }

  private buildRsvpActionUrl(
    magicUrl: string,
    rehearsalId: string,
    response: 'CONFIRMED' | 'DECLINED',
  ): string {
    const url = new URL(magicUrl);
    url.searchParams.set('rehearsalId', rehearsalId);
    url.searchParams.set('response', response);
    return url.toString();
  }
}
