import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { countUnexcusedAbsences, getEuropeBerlinStartOfDay } from '../admin/unexcused-absence-count';
import { MemberStatusService } from './member-status.service';

@Injectable()
export class DisableUnexcusedMembersTask {
  private readonly logger = new Logger(DisableUnexcusedMembersTask.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly memberStatusService: MemberStatusService,
  ) {}

  @Cron('0 0 6 * * *', { timeZone: 'Europe/Berlin' })
  async runDailyDisablement(): Promise<void> {
    const startOfToday = getEuropeBerlinStartOfDay();
    const rehearsals = await this.prisma.rehearsal.findMany({
      where: {
        date: { lt: startOfToday },
        isOptional: false,
        attendanceRecords: { some: {} },
      },
      select: {
        id: true,
        date: true,
        isOptional: true,
        attendanceRecords: { take: 1, select: { id: true } },
      },
    });
    if (rehearsals.length === 0) return;

    const rehearsalIds = rehearsals.map(({ id }) => id);
    const members = await this.prisma.member.findMany({
      where: { isDisabled: false },
      select: {
        id: true,
        createdAt: true,
        attendanceRecords: {
          where: { rehearsalId: { in: rehearsalIds } },
          select: { rehearsalId: true },
        },
        attendancePlans: {
          where: { rehearsalId: { in: rehearsalIds }, response: 'DECLINED' },
          select: { rehearsalId: true },
        },
      },
    });

    for (const member of members) {
      const absenceCount = countUnexcusedAbsences({
        memberCreatedAt: member.createdAt,
        rehearsals: rehearsals.map(({ attendanceRecords, ...rehearsal }) => ({
          ...rehearsal,
          hasAttendanceRecord: attendanceRecords.length > 0,
        })),
        attendedRehearsalIds: member.attendanceRecords.map(({ rehearsalId }) => rehearsalId),
        declinedRehearsalIds: member.attendancePlans.map(({ rehearsalId }) => rehearsalId),
        now: startOfToday,
      });
      if (absenceCount < 3) continue;

      try {
        await this.memberStatusService.disable(member.id, undefined, true);
      } catch (error) {
        this.logger.error(`Unable to disable member ${member.id}: ${String(error)}`);
      }
    }
  }
}
