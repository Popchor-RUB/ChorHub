import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRehearsalDto } from './dto/create-rehearsal.dto';
import { UpdateRehearsalDto } from './dto/update-rehearsal.dto';

@Injectable()
export class RehearsalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async findUpcoming(memberId?: string) {
    return this.findForMember(memberId, false);
  }

  async findAllForMember(memberId: string) {
    return this.findForMember(memberId, true);
  }

  private async findForMember(memberId: string | undefined, includeAll: boolean) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const base = {
      where: includeAll ? undefined : { date: { gte: startOfToday } },
      orderBy: { date: includeAll ? ('desc' as const) : ('asc' as const) },
    };

    if (memberId) {
      const rehearsals = await this.prisma.rehearsal.findMany({
        ...base,
        include: {
          attendancePlans: { where: { memberId }, select: { response: true } },
          attendanceRecords: { where: { memberId }, select: { id: true } },
          _count: { select: { attendanceRecords: true } },
        },
      });
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      return rehearsals.map((r) => ({
        id: r.id,
        date: r.date,
        title: r.title,
        description: r.description,
        location: r.location,
        durationMinutes: r.durationMinutes,
        myPlan: r.attendancePlans[0]?.response ?? null,
        myAttended:
          r.attendanceRecords.length > 0
            ? true
            : r._count.attendanceRecords > 0 && r.date < oneHourAgo
              ? false
              : null,
      }));
    }

    const rehearsals = await this.prisma.rehearsal.findMany(base);
    return rehearsals.map((r) => ({
      id: r.id,
      date: r.date,
      title: r.title,
      description: r.description,
      location: r.location,
      durationMinutes: r.durationMinutes,
      myPlan: undefined,
      myAttended: undefined,
    }));
  }

  async findAll() {
    return this.prisma.rehearsal.findMany({
      orderBy: { date: 'desc' },
    });
  }

  async getMemberCalendar() {
    const rehearsals = await this.prisma.rehearsal.findMany({
      orderBy: { date: 'asc' },
    });

    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:5173');
    const domain = this.extractHostname(appUrl);

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ChorHub//Rehearsals//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:ChorHub Rehearsals',
      ...rehearsals.flatMap((rehearsal) => {
        const updatedAt = rehearsal.updatedAt ?? rehearsal.createdAt ?? new Date();
        const dtEnd = rehearsal.durationMinutes
          ? new Date(rehearsal.date.getTime() + rehearsal.durationMinutes * 60_000)
          : null;
        return [
          'BEGIN:VEVENT',
          `UID:rehearsal-${rehearsal.id}@${domain}`,
          `SEQUENCE:${Math.floor(updatedAt.getTime() / 1000)}`,
          `DTSTAMP:${this.toIcalDateTime(updatedAt)}`,
          `LAST-MODIFIED:${this.toIcalDateTime(updatedAt)}`,
          `DTSTART:${this.toIcalDateTime(rehearsal.date)}`,
          ...(dtEnd ? [`DTEND:${this.toIcalDateTime(dtEnd)}`] : []),
          `SUMMARY:${this.escapeIcalText(rehearsal.title)}`,
          ...(rehearsal.location ? [`LOCATION:${this.escapeIcalText(rehearsal.location)}`] : []),
          `DESCRIPTION:${this.escapeIcalText(rehearsal.description ?? '')}`,
          'END:VEVENT',
        ];
      }),
      'END:VCALENDAR',
    ];

    return `${lines.join('\r\n')}\r\n`;
  }

  async create(dto: CreateRehearsalDto) {
    return this.prisma.rehearsal.create({
      data: {
        date: new Date(dto.date),
        title: dto.title,
        description: dto.description,
        location: dto.location,
        durationMinutes: dto.durationMinutes,
      },
    });
  }

  async update(id: string, dto: UpdateRehearsalDto) {
    await this.ensureExists(id);
    return this.prisma.rehearsal.update({
      where: { id },
      data: {
        ...(dto.date && { date: new Date(dto.date) }),
        ...(dto.title && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.durationMinutes !== undefined && { durationMinutes: dto.durationMinutes }),
      },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.rehearsal.delete({ where: { id } });
  }

  private async ensureExists(id: string) {
    const rehearsal = await this.prisma.rehearsal.findUnique({ where: { id } });
    if (!rehearsal) throw new NotFoundException('Probe nicht gefunden');
    return rehearsal;
  }

  private toIcalDateTime(value: Date) {
    return value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  }

  private escapeIcalText(value: string) {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/\r\n|\r|\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
  }

  private extractHostname(url: string) {
    try {
      return new URL(url).hostname;
    } catch {
      return 'chorhub.local';
    }
  }
}
