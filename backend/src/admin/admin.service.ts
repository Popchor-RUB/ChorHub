import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { ChoirVoice } from '../generated/prisma/client';
import { randomBytes, createHash } from 'crypto';
import { parse } from 'csv-parse/sync';
import * as ExcelJS from 'exceljs';

const CHOIR_VOICE_LABELS: Record<string, string> = {
  SOPRAN: 'Sopran',
  MEZZOSOPRAN: 'Mezzosopran',
  ALT: 'Alt',
  TENOR: 'Tenor',
  BARITON: 'Bariton',
  BASS: 'Bass',
};

const CHOIR_VOICES = Object.values(ChoirVoice);

interface CsvRow {
  firstName: string;
  lastName: string;
  email: string;
  choirVoice: string;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  async importMembersFromCsv(buffer: Buffer) {
    let records: CsvRow[];
    try {
      records = parse(buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch {
      throw new BadRequestException('Ungültiges CSV-Format');
    }

    const results = { created: 0, updated: 0, failed: [] as { email: string; reason: string }[] };

    for (const row of records) {
      if (!row.firstName || !row.lastName || !row.email || !row.choirVoice) {
        results.failed.push({ email: row.email ?? '?', reason: 'Fehlende Pflichtfelder' });
        continue;
      }

      const normalizedVoice = row.choirVoice.toUpperCase().replace(/\s+/g, '_');
      if (!CHOIR_VOICES.includes(normalizedVoice as ChoirVoice)) {
        results.failed.push({
          email: row.email,
          reason: `Ungültige Stimmlage: ${row.choirVoice}`,
        });
        continue;
      }

      try {
        const rawToken = randomBytes(32).toString('hex');
        const hashedToken = createHash('sha256').update(rawToken).digest('hex');

        const existing = await this.prisma.member.findUnique({ where: { email: row.email } });

        const member = await this.prisma.member.upsert({
          where: { email: row.email },
          create: {
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email,
            choirVoice: normalizedVoice as ChoirVoice,
            loginToken: hashedToken,
          },
          update: {
            firstName: row.firstName,
            lastName: row.lastName,
            choirVoice: normalizedVoice as ChoirVoice,
            loginToken: hashedToken,
          },
        });

        // Only send invitation email to newly created members
        if (!existing) {
          const magicUrl = `${this.config.get('APP_URL')}/auth/verify?token=${rawToken}`;
          await this.mailService.sendMemberInvite(member, magicUrl);
          results.created++;
        } else {
          results.updated++;
        }
      } catch (e: unknown) {
        results.failed.push({ email: row.email, reason: e instanceof Error ? e.message : String(e) });
      }
    }

    return results;
  }

  async getMemberOverview() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [totalPastRehearsals, members] = await Promise.all([
      this.prisma.rehearsal.count({ where: { date: { lt: startOfToday } } }),
      this.prisma.member.findMany({
        orderBy: [{ lastName: 'asc' }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          choirVoice: true,
          createdAt: true,
          _count: { select: { attendanceRecords: true } },
          attendanceRecords: {
            where: { rehearsal: { date: { lt: startOfToday } } },
            select: { rehearsalId: true },
          },
          attendancePlans: {
            where: { response: 'DECLINED', rehearsal: { date: { lt: startOfToday } } },
            select: { rehearsalId: true },
          },
        },
      }),
    ]);

    return members.map((m) => {
      const attendedPastIds = new Set(m.attendanceRecords.map((r) => r.rehearsalId));
      const declinedPastIds = new Set(m.attendancePlans.map((p) => p.rehearsalId));
      const declinedNotAttended = [...declinedPastIds].filter((id) => !attendedPastIds.has(id)).length;
      const unexcusedAbsenceCount = Math.max(0, totalPastRehearsals - attendedPastIds.size - declinedNotAttended);

      return {
        id: m.id,
        firstName: m.firstName,
        lastName: m.lastName,
        email: m.email,
        choirVoice: m.choirVoice,
        createdAt: m.createdAt,
        attendanceCount: m._count.attendanceRecords,
        unexcusedAbsenceCount,
      };
    });
  }

  async searchMembers(query: string) {
    const q = query.trim();
    if (!q) return [];

    // Split on commas or whitespace to detect combined-name queries
    const parts = q.split(/[,\s]+/).filter(Boolean);

    const conditions = [
      { firstName: { contains: q, mode: 'insensitive' as const } },
      { lastName: { contains: q, mode: 'insensitive' as const } },
      { email: { contains: q, mode: 'insensitive' as const } },
    ];

    if (parts.length >= 2) {
      const [a, b] = parts;
      // "FirstName LastName" / "FirstName, LastName"
      conditions.push({
        AND: [
          { firstName: { contains: a, mode: 'insensitive' as const } },
          { lastName: { contains: b, mode: 'insensitive' as const } },
        ],
      } as any);
      // "LastName, FirstName" / "LastName FirstName"
      conditions.push({
        AND: [
          { firstName: { contains: b, mode: 'insensitive' as const } },
          { lastName: { contains: a, mode: 'insensitive' as const } },
        ],
      } as any);
    }

    return this.prisma.member.findMany({
      where: { OR: conditions },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        choirVoice: true,
        email: true,
      },
      take: 10,
      orderBy: [{lastName: "asc"}, {firstName: "asc"}]
    });
  }

  async getMemberRehearsals(memberId: string) {
    const rehearsals = await this.prisma.rehearsal.findMany({
      orderBy: { date: 'asc' },
      include: {
        attendanceRecords: {
          where: { memberId },
          select: { id: true },
        },
        attendancePlans: {
          where: { memberId },
          select: { response: true },
        },
      },
    });

    return rehearsals.map((r) => ({
      id: r.id,
      date: r.date,
      title: r.title,
      attended: r.attendanceRecords.length > 0,
      plan: r.attendancePlans[0]?.response ?? null,
    }));
  }

  async exportMembersExcel(): Promise<Buffer> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [rehearsals, members] = await Promise.all([
      this.prisma.rehearsal.findMany({
        where: { date: { lt: startOfToday } },
        orderBy: { date: 'asc' },
        select: { id: true, date: true, title: true },
      }),
      this.prisma.member.findMany({
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          choirVoice: true,
          attendanceRecords: {
            where: { rehearsal: { date: { lt: startOfToday } } },
            select: { rehearsalId: true },
          },
          attendancePlans: {
            where: { response: 'DECLINED', rehearsal: { date: { lt: startOfToday } } },
            select: { rehearsalId: true },
          },
        },
      }),
    ]);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Mitglieder');

    const formatDate = (d: Date) =>
      new Intl.DateTimeFormat('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(d);

    const headerRow = sheet.addRow([
      'Name',
      'E-Mail',
      'Stimme',
      'Proben besucht',
      'Unentschuldigt',
      ...rehearsals.map((r) => `${formatDate(r.date)} – ${r.title}`),
    ]);
    headerRow.font = { bold: true };

    for (const m of members) {
      const attendedIds = new Set(m.attendanceRecords.map((r) => r.rehearsalId));
      const declinedIds = new Set(m.attendancePlans.map((p) => p.rehearsalId));

      const attendanceCount = attendedIds.size;
      const unexcusedCount = rehearsals.filter(
        (r) => !attendedIds.has(r.id) && !declinedIds.has(r.id),
      ).length;

      const rehearsalStatuses = rehearsals.map((r) => {
        if (attendedIds.has(r.id)) return 'ja';
        if (declinedIds.has(r.id)) return 'nein';
        return 'unentschuldigt';
      });

      sheet.addRow([
        `${m.lastName}, ${m.firstName}`,
        m.email,
        CHOIR_VOICE_LABELS[m.choirVoice] ?? m.choirVoice,
        attendanceCount,
        unexcusedCount,
        ...rehearsalStatuses,
      ]);
    }

    sheet.columns.forEach((col) => {
      col.width = 20;
    });

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  async getMemberHistory(memberId: string) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        choirVoice: true,
        attendanceRecords: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            rehearsal: {
              select: { id: true, date: true, title: true },
            },
          },
        },
      },
    });
    if (!member) return null;
    return {
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      choirVoice: member.choirVoice,
      recentAttendance: member.attendanceRecords.map((r) => r.rehearsal),
    };
  }
}
