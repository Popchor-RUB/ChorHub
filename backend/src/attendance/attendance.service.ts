import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceResponse, ChoirVoice } from '@prisma/client';
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
    await this.ensureRehearsalExists(rehearsalId);
    const members = await this.prisma.member.findMany({
      orderBy: [{ choirVoice: 'asc' }, { lastName: 'asc' }],
      include: {
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
    return members.map((m) => ({
      id: m.id,
      firstName: m.firstName,
      lastName: m.lastName,
      choirVoice: m.choirVoice,
      attended: m.attendanceRecords.length > 0,
      plan: m.attendancePlans[0]?.response ?? null,
    }));
  }

  async bulkSetAttendanceRecords(rehearsalId: string, memberIds: string[]) {
    await this.ensureRehearsalExists(rehearsalId);

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
          include: { member: { select: { choirVoice: true } } },
        },
      },
    });

    return rehearsals.map((r) => ({
      id: r.id,
      date: r.date,
      title: r.title,
      totalConfirmed: r.attendancePlans.length,
      byVoice: this.groupByVoice(
        r.attendancePlans.map((p) => p.member.choirVoice),
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
          include: { member: { select: { choirVoice: true } } },
        },
      },
    });

    return rehearsals.map((r) => ({
      id: r.id,
      date: r.date,
      title: r.title,
      totalAttended: r.attendanceRecords.length,
      byVoice: this.groupByVoice(
        r.attendanceRecords.map((rec) => rec.member.choirVoice),
      ),
    }));
  }

  private groupByVoice(voices: ChoirVoice[]): Record<string, number> {
    const result: Record<string, number> = {};
    for (const voice of voices) {
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
