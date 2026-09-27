import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SentEmailStatus } from '../generated/prisma/client';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

const SUBJECT_PREFIX = '[Popchor Mitglieder]';
const MAX_TOTAL_ATTACHMENT_SIZE = 20 * 1024 * 1024;

export interface EmailAttachmentMetadata {
  id: string;
  filename: string;
  contentType: string;
  size: number;
}

export interface EmailArchiveEntry {
  id: string;
  subject: string;
  rawSubject: string;
  markdownContent: string;
  signatureMarkdown: string;
  sentAt: Date;
  attachments: EmailAttachmentMetadata[];
}

@Injectable()
export class EmailsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async listSentEmails(): Promise<EmailArchiveEntry[]> {
    const emails = await this.prisma.sentEmail.findMany({
      where: { status: SentEmailStatus.SENT },
      orderBy: { sentAt: 'desc' },
      include: { attachments: { select: { id: true, filename: true, contentType: true, size: true } } },
    });
    return emails.map((email) => this.toArchiveEntry(email));
  }

  async getSentEmail(id: string): Promise<EmailArchiveEntry> {
    const email = await this.prisma.sentEmail.findFirst({
      where: { id, status: SentEmailStatus.SENT },
      include: { attachments: { select: { id: true, filename: true, contentType: true, size: true } } },
    });
    if (!email) {
      throw new NotFoundException('E-Mail nicht gefunden');
    }
    return this.toArchiveEntry(email);
  }

  async getAttachment(emailId: string, attachmentId: string) {
    const attachment = await this.prisma.sentEmailAttachment.findFirst({
      where: { id: attachmentId, sentEmailId: emailId, sentEmail: { status: SentEmailStatus.SENT } },
      select: { id: true, filename: true, contentType: true, content: true },
    });
    if (!attachment) {
      throw new NotFoundException('Anhang nicht gefunden');
    }
    return attachment;
  }

  async sendEmail(
    subjectInput: string,
    markdownContent: string,
    signatureMarkdown: string | undefined,
    files: Express.Multer.File[],
  ): Promise<EmailArchiveEntry> {
    const subject = this.normalizeSubject(subjectInput);
    if (!markdownContent?.trim()) {
      throw new BadRequestException('Der E-Mail-Inhalt darf nicht leer sein');
    }

    const content = markdownContent;
    const signatureInput = signatureMarkdown ?? '';
    const signature = signatureInput.trim() ? signatureInput : '';
    const attachmentSize = files.reduce((total, file) => total + file.size, 0);
    if (attachmentSize > MAX_TOTAL_ATTACHMENT_SIZE) {
      throw new BadRequestException('Anhänge dürfen zusammen höchstens 20 MB groß sein');
    }

    const adminEmail = process.env.CHOIR_ADMIN_EMAIL?.trim();
    if (!adminEmail) {
      throw new InternalServerErrorException('CHOIR_ADMIN_EMAIL ist nicht konfiguriert');
    }

    const members = await this.prisma.member.findMany({
      where: { isDisabled: false },
      select: { email: true },
    });
    const recipientKeys = new Set<string>();
    const adminEmailKey = adminEmail.toLocaleLowerCase('en-US');
    const bcc = members.flatMap(({ email: memberEmail }) => {
      const normalizedEmail = memberEmail.trim();
      const key = normalizedEmail.toLocaleLowerCase('en-US');
      if (!normalizedEmail || key === adminEmailKey || recipientKeys.has(key)) {
        return [];
      }
      recipientKeys.add(key);
      return [normalizedEmail];
    });

    const email = await this.prisma.sentEmail.create({
      data: {
        subject,
        markdownContent: content,
        signatureMarkdown: signature,
        status: SentEmailStatus.PENDING,
        attachments: {
          create: files.map((file) => ({
            filename: file.originalname,
            contentType: file.mimetype || 'application/octet-stream',
            size: file.size,
            content: new Uint8Array(file.buffer),
          })),
        },
      },
      include: { attachments: true },
    });

    try {
      await this.mailService.sendInformationEmail({
        to: adminEmail,
        bcc,
        subject: `${SUBJECT_PREFIX} ${subject}`,
        markdownContent: content,
        signatureMarkdown: signature,
        attachments: email.attachments,
      });
    } catch (error) {
      await this.prisma.sentEmail.update({
        where: { id: email.id },
        data: { status: SentEmailStatus.FAILED },
      });
      throw error;
    }

    const sentEmail = await this.prisma.sentEmail.update({
      where: { id: email.id },
      data: { status: SentEmailStatus.SENT, sentAt: new Date() },
      include: {
        attachments: { select: { id: true, filename: true, contentType: true, size: true } },
      },
    });
    return this.toArchiveEntry(sentEmail);
  }

  private normalizeSubject(value: string): string {
    const subject = value?.trim().replace(/^\[Popchor Mitglieder\]\s*/i, '');
    if (!subject) {
      throw new BadRequestException('Der Betreff darf nicht leer sein');
    }
    return subject;
  }

  private toArchiveEntry(email: {
    id: string;
    subject: string;
    markdownContent: string;
    signatureMarkdown: string;
    sentAt: Date | null;
    attachments: EmailAttachmentMetadata[];
  }): EmailArchiveEntry {
    if (!email.sentAt) {
      throw new NotFoundException('E-Mail nicht gefunden');
    }
    return {
      id: email.id,
      subject: `${SUBJECT_PREFIX} ${email.subject}`,
      rawSubject: email.subject,
      markdownContent: email.markdownContent,
      signatureMarkdown: email.signatureMarkdown,
      sentAt: email.sentAt,
      attachments: email.attachments,
    };
  }
}
