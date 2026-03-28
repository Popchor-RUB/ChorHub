import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceResponse } from '../generated/prisma/client';
import { SetAttendancePlanDto } from './dto/attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async setAttendancePlan(memberId: string, rehearsalId: string, dto: SetAttendancePlanDto) {
    const rehearsal = await this.ensureRehearsalExists(rehearsalId);
    if (rehearsal.date <= new Date()) {
      throw new ForbiddenException('Probe hat bereits begonnen oder ist vergangen');
    }
    return this.prisma.attendancePlan.upsert({
      where: { memberId_rehearsalId: { memberId, rehearsalId } },
      create: { memberId, rehearsalId, response: dto.response },
      update: { response: dto.response },
    });
  }

  async deleteAttendancePlan(memberId: string, rehearsalId: string) {
    const rehearsal = await this.ensureRehearsalExists(rehearsalId);
    if (rehearsal.date <= new Date()) {
      throw new ForbiddenException('Probe hat bereits begonnen oder ist vergangen');
    }
    await this.prisma.attendancePlan.deleteMany({
      where: { memberId, rehearsalId },
    });
    return { deleted: true };
  }

  async getRecordsForRehearsal(rehearsalId: string) {
    const rehearsal = await this.ensureRehearsalExists(rehearsalId);

    // Past rehearsals ordered most-recent first — position i+1 = "i+1 rehearsals ago"
    const pastRehearsals = await this.prisma.rehearsal.findMany({
      where: { date: { lt: rehearsal.date }, isOptional: false },
      orderBy: { date: 'desc' },
      select: { id: true },
    });
    const agoByRehearsalId = new Map(pastRehearsals.map((r, i) => [r.id, i + 1]));

    const members = await this.prisma.member.findMany({
      orderBy: [{ choirVoice: { sortOrder: 'asc' } }, { firstName: 'asc' }, { lastName: 'asc' }],
      include: {
        choirVoice: { select: { id: true, name: true } },
        attendanceRecords: {
          where: { rehearsalId },
          select: { id: true },
        },
        attendancePlans: {
          where: { rehearsalId },
          select: { response: true },
        },
      },
    });

    // Bulk fetch all past attendance records and find the most recent per member
    const lastAttendedMap = new Map<string, number>();
    if (pastRehearsals.length > 0) {
      const pastAttendances = await this.prisma.attendanceRecord.findMany({
        where: {
          rehearsalId: { in: pastRehearsals.map((r) => r.id) },
          rehearsal: { isOptional: false },
        },
        select: { memberId: true, rehearsalId: true },
      });
      for (const rec of pastAttendances) {
        const ago = agoByRehearsalId.get(rec.rehearsalId);
        if (ago !== undefined) {
          const current = lastAttendedMap.get(rec.memberId);
          if (current === undefined || ago < current) {
            lastAttendedMap.set(rec.memberId, ago);
          }
        }
      }
    }

    return members.map((m) => ({
      id: m.id,
      firstName: m.firstName,
      lastName: m.lastName,
      email: m.email,
      choirVoice: m.choirVoice,
      attended: m.attendanceRecords.length > 0,
      plan: m.attendancePlans[0]?.response ?? null,
      lastAttendedRehearsalsAgo: lastAttendedMap.get(m.id) ?? null,
    }));
  }

  async bulkSetAttendanceRecords(rehearsalId: string, memberIds: string[]) {
    const rehearsal = await this.ensureRehearsalExists(rehearsalId);
    if (rehearsal.isOptional) {
      throw new ForbiddenException('Für optionale Proben wird keine Anwesenheit erfasst');
    }

    await this.prisma.attendanceRecord.deleteMany({ where: { rehearsalId } });

    if (memberIds.length > 0) {
      await this.prisma.attendanceRecord.createMany({
        data: memberIds.map((memberId) => ({ memberId, rehearsalId })),
        skipDuplicates: true,
      });
    }

    return { rehearsalId, recorded: memberIds.length };
  }

  async getFutureOverview() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const rehearsals = await this.prisma.rehearsal.findMany({
      where: { date: { gte: startOfToday } },
      orderBy: { date: 'asc' },
      include: {
        attendancePlans: {
          where: { response: AttendanceResponse.CONFIRMED },
          include: { member: { select: { choirVoice: { select: { name: true } } } } },
        },
      },
    });

    return rehearsals.map((r) => ({
      id: r.id,
      date: r.date,
      title: r.title,
      durationMinutes: r.durationMinutes,
      isOptional: r.isOptional,
      totalConfirmed: r.attendancePlans.length,
      byVoice: this.groupByVoice(
        r.attendancePlans.map((p) => p.member.choirVoice?.name),
      ),
    }));
  }

  async getPastOverview() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const rehearsals = await this.prisma.rehearsal.findMany({
      where: { date: { lt: startOfToday } },
      orderBy: { date: 'desc' },
      include: {
        attendanceRecords: {
          include: { member: { select: { choirVoice: { select: { name: true } } } } },
        },
      },
    });

    return rehearsals.map((r) => ({
      id: r.id,
      date: r.date,
      title: r.title,
      durationMinutes: r.durationMinutes,
      isOptional: r.isOptional,
      totalAttended: r.attendanceRecords.length,
      byVoice: this.groupByVoice(
        r.attendanceRecords.map((rec) => rec.member.choirVoice?.name),
      ),
    }));
  }

  private groupByVoice(voices: (string | null | undefined)[]): Record<string, number> {
    const result: Record<string, number> = {};
    for (const voice of voices) {
      if (!voice) continue;
      result[voice] = (result[voice] ?? 0) + 1;
    }
    return result;
  }

  private async ensureRehearsalExists(rehearsalId: string) {
    const rehearsal = await this.prisma.rehearsal.findUnique({
      where: { id: rehearsalId },
    });
    if (!rehearsal) throw new NotFoundException('Probe nicht gefunden');
    return rehearsal;
  }
}
