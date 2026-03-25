import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from './push.service';

@Injectable()
export class RehearsalReminderTask {
  private readonly logger = new Logger(RehearsalReminderTask.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
  ) {}

  @Cron('0 9 * * *')
  async sendDailyReminders(): Promise<void> {
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const nextRehearsal = await this.prisma.rehearsal.findFirst({
      where: { date: { gte: startOfToday }, isOptional: false },
      orderBy: { date: 'asc' },
    });

    if (!nextRehearsal) return;

    const daysUntil = Math.round(
      (nextRehearsal.date.getTime() - startOfToday.getTime()) / 86_400_000,
    );

    if (daysUntil > 3) return;

    const allMembers = await this.prisma.member.findMany({ select: { id: true } });

    const plans = await this.prisma.attendancePlan.findMany({
      where: { rehearsalId: nextRehearsal.id },
      select: { memberId: true },
    });
    const plannedIds = new Set(plans.map((p) => p.memberId));
    const unplanned = allMembers.filter((m) => !plannedIds.has(m.id));

    this.logger.log(
      `Rehearsal ${nextRehearsal.id} in ${daysUntil} day(s): sending reminders to ${unplanned.length} members`,
    );

    if (unplanned.length === 0) return;

    const weekday = nextRehearsal.date.toLocaleDateString('de-DE', {
      weekday: 'long',
      timeZone: 'UTC',
    });

    const title =
      daysUntil === 0 ? 'ChorHub – Probe heute!' : `ChorHub – Probe am ${weekday}!`;

    await Promise.allSettled(
      unplanned.map((m) =>
        this.pushService.sendToMember(m.id, {
          title,
          body: `Deine Anwesenheitsangabe für die Probe am ${weekday} fehlt noch!`,
          url: '/proben',
        }),
      ),
    );
  }
}
