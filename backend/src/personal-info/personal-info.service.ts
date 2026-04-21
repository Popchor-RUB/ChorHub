import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Member } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { MailQueueService } from '../mail/mail-queue.service';

const CONFIG_SINGLETON_ID = 'main';
const DEFAULT_EMAIL_SUBJECT = 'Neue persönliche Informationen';
const GLOBAL_PLACEHOLDERS = ['firstname', 'lastname'] as const;

interface PublishInput {
  markdownTemplate: string;
  emailSubject: string;
  sendEmail: boolean;
  deleteNonTargetedEntries?: boolean;
  recipientMode: string;
  recipientFile?: Express.Multer.File;
  placeholderNamesJson: string;
  placeholderFiles: Express.Multer.File[];
}

export type PersonalInfoSendStatusState = 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED';

interface PersonalInfoMailQueueEntry {
  member: Member;
  subject: string;
  markdownContent: string;
}

export interface PersonalInfoSendStatus {
  status: PersonalInfoSendStatusState;
  total: number;
  sent: number;
  failed: number;
  remaining: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  lastError: string | null;
}

@Injectable()
export class PersonalInfoService {
  private static readonly PERSONAL_INFO_QUEUE = 'personal-info-campaign';
  private static readonly MAIL_SEND_INTERVAL_MS = 60_000;
  private readonly logger = new Logger(PersonalInfoService.name);
  private sendStatus: PersonalInfoSendStatus = {
    status: 'IDLE',
    total: 0,
    sent: 0,
    failed: 0,
    remaining: 0,
    startedAt: null,
    finishedAt: null,
    lastError: null,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly mailQueueService: MailQueueService,
  ) {}

  async getConfig() {
    return this.prisma.personalInfoConfig.upsert({
      where: { id: CONFIG_SINGLETON_ID },
      create: {
        id: CONFIG_SINGLETON_ID,
        markdownTemplate: '',
        emailSubject: DEFAULT_EMAIL_SUBJECT,
      },
      update: {},
    });
  }

  async getMemberInfo(memberId: string) {
    const entry = await this.prisma.personalInfoEntry.findUnique({
      where: { memberId },
    });

    return {
      id: entry?.id ?? null,
      memberId,
      markdownContent: entry?.markdownContent ?? '',
      updatedAt: entry?.updatedAt ?? null,
    };
  }

  getSendStatus(): PersonalInfoSendStatus {
    return {
      ...this.sendStatus,
      remaining: this.mailQueueService.getPendingCount(PersonalInfoService.PERSONAL_INFO_QUEUE),
    };
  }

  async publish(input: PublishInput) {
    const markdownTemplate = input.markdownTemplate.trim();
    const emailSubject = input.emailSubject.trim();

    if (!markdownTemplate) {
      throw new BadRequestException('Markdown-Vorlage darf nicht leer sein');
    }
    if (!emailSubject) {
      throw new BadRequestException('E-Mail-Betreff darf nicht leer sein');
    }

    const members = await this.resolveRecipients(input.recipientMode, input.recipientFile);
    const placeholderNames = this.parsePlaceholderNames(input.placeholderNamesJson);
    this.validatePlaceholderNames(placeholderNames);

    if (placeholderNames.length !== input.placeholderFiles.length) {
      throw new BadRequestException('Anzahl Placeholder-Namen und Dateien stimmt nicht überein');
    }

    const placeholderLines = new Map<string, string[]>();
    for (let index = 0; index < placeholderNames.length; index += 1) {
      const name = placeholderNames[index];
      const values = this.parseValueLines(input.placeholderFiles[index]);
      if (values.length !== members.length) {
        throw new BadRequestException(
          `Zeilenanzahl für Placeholder {{${name}}} muss ${members.length} sein`,
        );
      }
      placeholderLines.set(name, values);
    }

    this.ensureTemplateHasKnownPlaceholders(markdownTemplate, placeholderNames);

    const entries = members.map((member, index) => {
      const valueMap: Record<string, string> = {
        firstname: member.firstName,
        lastname: member.lastName,
      };
      for (const [name, values] of placeholderLines.entries()) {
        valueMap[name.toLowerCase()] = values[index] ?? '';
      }

      return {
        member,
        markdownContent: this.renderTemplate(markdownTemplate, valueMap),
      };
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.personalInfoConfig.upsert({
        where: { id: CONFIG_SINGLETON_ID },
        create: {
          id: CONFIG_SINGLETON_ID,
          markdownTemplate,
          emailSubject,
        },
        update: {
          markdownTemplate,
          emailSubject,
        },
      });

      if (input.deleteNonTargetedEntries) {
        const memberIds = entries.map((entry) => entry.member.id);
        if (memberIds.length === 0) {
          await tx.personalInfoEntry.deleteMany();
        } else {
          await tx.personalInfoEntry.deleteMany({
            where: {
              memberId: { notIn: memberIds },
            },
          });
        }
      }

      for (const entry of entries) {
        await tx.personalInfoEntry.upsert({
          where: { memberId: entry.member.id },
          create: {
            memberId: entry.member.id,
            markdownContent: entry.markdownContent,
          },
          update: {
            markdownContent: entry.markdownContent,
          },
        });
      }
    });

    if (input.sendEmail) {
      if (
        this.sendStatus.status === 'RUNNING' ||
        this.mailQueueService.isRunning(PersonalInfoService.PERSONAL_INFO_QUEUE)
      ) {
        throw new ConflictException('Eine E-Mail-Kampagne läuft bereits');
      }
      this.startMailCampaign(
        entries.map((entry) => ({
          member: entry.member,
          subject: emailSubject,
          markdownContent: entry.markdownContent,
        })),
      );
    }

    return {
      updatedCount: entries.length,
      sentCount: 0,
    };
  }

  async listMemberRows() {
    const members = await this.prisma.member.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        personalInfo: {
          select: {
            updatedAt: true,
          },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return members.map((member) => ({
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      hasPersonalInfo: Boolean(member.personalInfo),
      updatedAt: member.personalInfo?.updatedAt ?? null,
    }));
  }

  async getMemberRow(memberId: string) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        personalInfo: {
          select: {
            id: true,
            markdownContent: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Mitglied nicht gefunden');
    }

    return {
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      personalInfo: {
        id: member.personalInfo?.id ?? null,
        markdownContent: member.personalInfo?.markdownContent ?? '',
        updatedAt: member.personalInfo?.updatedAt ?? null,
      },
    };
  }

  async upsertMemberInfo(memberId: string, markdownContent: string) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      select: { id: true },
    });

    if (!member) {
      throw new NotFoundException('Mitglied nicht gefunden');
    }

    return this.prisma.personalInfoEntry.upsert({
      where: { memberId },
      create: { memberId, markdownContent },
      update: { markdownContent },
    });
  }

  private startMailCampaign(entries: PersonalInfoMailQueueEntry[]) {
    this.sendStatus = {
      status: entries.length > 0 ? 'RUNNING' : 'COMPLETED',
      total: entries.length,
      sent: 0,
      failed: 0,
      remaining: entries.length,
      startedAt: new Date(),
      finishedAt: entries.length > 0 ? null : new Date(),
      lastError: null,
    };

    if (entries.length > 0) {
      this.mailQueueService.setOnDrained(
        PersonalInfoService.PERSONAL_INFO_QUEUE,
        () => {
          if (this.sendStatus.status !== 'RUNNING') {
            return;
          }
          this.sendStatus.remaining = 0;
          this.sendStatus.status = this.sendStatus.failed > 0 ? 'FAILED' : 'COMPLETED';
          this.sendStatus.finishedAt = new Date();
        },
      );
      this.mailQueueService.enqueueMany(
        PersonalInfoService.PERSONAL_INFO_QUEUE,
        entries.map((entry) => async () => {
          try {
            await this.mailService.sendPersonalInfo(entry.member, entry.subject, entry.markdownContent);
            this.sendStatus.sent += 1;
          } catch (error: unknown) {
            this.sendStatus.failed += 1;
            this.sendStatus.lastError = error instanceof Error ? error.message : String(error);
            this.logger.error(
              `Failed to send personal info email to ${entry.member.email}: ${this.sendStatus.lastError}`,
            );
            this.logger.error(error);
          } finally {
            this.sendStatus.remaining = this.mailQueueService.getPendingCount(
              PersonalInfoService.PERSONAL_INFO_QUEUE,
            );
          }
        }),
        PersonalInfoService.MAIL_SEND_INTERVAL_MS,
      );
    }
  }

  private parseRecipientFile(file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Empfängerdatei fehlt');
    }

    const lines = this.parseTextLines(file.buffer).map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) {
      throw new BadRequestException('Empfängerdatei ist leer');
    }

    const seen = new Set<string>();
    for (const email of lines) {
      const normalized = email.toLowerCase();
      if (seen.has(normalized)) {
        throw new BadRequestException(`Empfänger doppelt vorhanden: ${email}`);
      }
      seen.add(normalized);
    }

    return lines;
  }

  private normalizeRecipientMode(recipientMode: string) {
    const mode = recipientMode.trim().toLowerCase();
    if (mode !== 'all' && mode !== 'file') {
      throw new BadRequestException('recipientMode muss "all" oder "file" sein');
    }
    return mode;
  }

  private parsePlaceholderNames(raw: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BadRequestException('placeholderNames muss ein JSON-Array sein');
    }

    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
      throw new BadRequestException('placeholderNames muss ein String-Array sein');
    }

    return parsed.map((item) => item.trim());
  }

  private validatePlaceholderNames(names: string[]) {
    const seen = new Set<string>();
    for (const name of names) {
      if (!name) {
        throw new BadRequestException('Placeholder-Name darf nicht leer sein');
      }
      if (!/^[a-zA-Z0-9_]+$/.test(name)) {
        throw new BadRequestException(`Ungültiger Placeholder-Name: ${name}`);
      }

      const lowerName = name.toLowerCase();
      if (GLOBAL_PLACEHOLDERS.includes(lowerName as (typeof GLOBAL_PLACEHOLDERS)[number])) {
        throw new BadRequestException(`Placeholder-Name reserviert: ${name}`);
      }
      if (seen.has(lowerName)) {
        throw new BadRequestException(`Placeholder-Name doppelt: ${name}`);
      }
      seen.add(lowerName);
    }
  }

  private parseValueLines(file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Placeholder-Datei fehlt');
    }
    return this.parseTextLines(file.buffer).map((line) => line.trim());
  }

  private parseTextLines(buffer: Buffer) {
    const normalized = buffer.toString('utf8').replace(/\r/g, '');
    const lines = normalized.split('\n');
    if (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }
    return lines;
  }

  private ensureTemplateHasKnownPlaceholders(markdownTemplate: string, customPlaceholderNames: string[]) {
    const placeholderMatches = markdownTemplate.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g);
    const used = new Set<string>();

    for (const match of placeholderMatches) {
      const name = match[1].toLowerCase();
      used.add(name);
    }

    const allowed = new Set<string>([
      ...GLOBAL_PLACEHOLDERS,
      ...customPlaceholderNames.map((name) => name.toLowerCase()),
    ]);

    const unknown = [...used].filter((name) => !allowed.has(name));
    if (unknown.length > 0) {
      throw new BadRequestException(`Unbekannte Placeholder in Vorlage: ${unknown.join(', ')}`);
    }
  }

  private async resolveRecipients(
    recipientMode: string,
    recipientFile?: Express.Multer.File,
  ) {
    const mode = this.normalizeRecipientMode(recipientMode);
    if (mode === 'all') {
      const members = await this.prisma.member.findMany({
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });
      if (members.length === 0) {
        throw new BadRequestException('Keine Mitglieder vorhanden');
      }
      return members;
    }

    const recipientEmails = this.parseRecipientFile(recipientFile);
    const members: Member[] = [];

    for (const email of recipientEmails) {
      const member = await this.prisma.member.findFirst({
        where: {
          email: {
            equals: email,
            mode: 'insensitive',
          },
        },
      });

      if (!member) {
        throw new BadRequestException(`Empfänger nicht gefunden: ${email}`);
      }

      members.push(member);
    }

    return members;
  }

  private renderTemplate(template: string, values: Record<string, string>) {
    return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, name: string) => {
      const key = name.toLowerCase();
      return values[key] ?? '';
    });
  }
}
