import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { ChoirVoice } from '@prisma/client';
import { randomBytes, createHash } from 'crypto';
import { parse } from 'csv-parse/sync';

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
      }) as CsvRow[];
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

        const magicUrl = `${this.config.get('APP_URL')}/auth/verify?token=${rawToken}`;
        await this.mailService.sendMemberInvite(member, magicUrl);

        if (existing) results.updated++;
        else results.created++;
      } catch (e: any) {
        results.failed.push({ email: row.email, reason: e.message });
      }
    }

    return results;
  }

  async getMemberOverview() {
    const members = await this.prisma.member.findMany({
      orderBy: [{ choirVoice: 'asc' }, { lastName: 'asc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        choirVoice: true,
        createdAt: true,
        _count: { select: { attendanceRecords: true } },
      },
    });

    return members.map((m) => ({
      id: m.id,
      firstName: m.firstName,
      lastName: m.lastName,
      email: m.email,
      choirVoice: m.choirVoice,
      createdAt: m.createdAt,
      attendanceCount: m._count.attendanceRecords,
    }));
  }

  async searchMembers(query: string) {
    const q = query.trim();
    if (!q) return [];
    return this.prisma.member.findMany({
      where: {
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        choirVoice: true,
        email: true,
      },
      take: 10,
    });
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
