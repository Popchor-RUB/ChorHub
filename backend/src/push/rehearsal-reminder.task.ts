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

  @Cron('0 8 * * *')
  async sendDailyReminders(): Promise<void> {
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startOfTomorrow = new Date(startOfToday.getTime() + 86_400_000);

    const rehearsals = await this.prisma.rehearsal.findMany({
      where: { date: { gte: startOfToday, lt: startOfTomorrow } },
    });

    if (rehearsals.length === 0) return;

    const allMembers = await this.prisma.member.findMany({ select: { id: true } });

    for (const rehearsal of rehearsals) {
      const plans = await this.prisma.attendancePlan.findMany({
        where: { rehearsalId: rehearsal.id },
        select: { memberId: true },
      });
      const plannedIds = new Set(plans.map((p) => p.memberId));

      const unplanned = allMembers.filter((m) => !plannedIds.has(m.id));
      this.logger.log(`Rehearsal ${rehearsal.id}: sending reminders to ${unplanned.length} members`);

      await Promise.allSettled(
        unplanned.map((m) =>
          this.pushService.sendToMember(m.id, {
            title: 'ChorHub – Probe heute!',
            body: `Hast du deine Anwesenheit für "${rehearsal.title}" eingetragen?`,
            url: '/proben',
          }),
        ),
      );
    }
  }
}
