import { BadRequestException, NotFoundException } from '@nestjs/common';
import { mockDeep } from 'jest-mock-extended';
import { Prisma, SentEmailStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailsService } from './emails.service';
import { MailService } from '../mail/mail.service';

describe('EmailsService', () => {
  const prisma = mockDeep<PrismaService>();
  const mailService = mockDeep<MailService>();
  const service = new EmailsService(prisma, mailService);
  const sentEmail = {
    id: 'mail-1',
    subject: 'Sommerfest',
    renderedSubject: null,
    markdownContent: 'Hallo zusammen',
    signatureMarkdown: 'Viele Grüße',
    status: SentEmailStatus.PENDING,
    sentAt: null,
    createdAt: new Date('2026-09-27T10:00:00.000Z'),
  };
  const sentEmailWithAttachments = {
    ...sentEmail,
    attachments: [],
  } as Prisma.SentEmailGetPayload<{ include: { attachments: true } }>;

  function member(email: string) {
    return {
      id: email,
      email,
      firstName: 'Test',
      lastName: 'Member',
      choirVoiceId: null,
      lastLoginAt: null,
      isDisabled: false,
      disabledAt: null,
      disableReason: null,
      internalComment: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CHOIR_ADMIN_EMAIL = 'admin@choir.test';
  });

  afterAll(() => {
    delete process.env.CHOIR_ADMIN_EMAIL;
  });

  it('sends one prefixed email to admin and unique active members in BCC', async () => {
    const sentAt = new Date('2026-09-27T10:01:00.000Z');
    prisma.sentEmail.create.mockResolvedValue(sentEmailWithAttachments);
    prisma.member.findMany.mockResolvedValue([
      member('admin@choir.test'),
      member('member@choir.test'),
      member('MEMBER@choir.test'),
      member('other@choir.test'),
    ]);
    mailService.sendInformationEmail.mockResolvedValue('[Popchor Mitglieder] Sommerfest');
    prisma.sentEmail.update.mockResolvedValue({
      ...sentEmail,
      status: SentEmailStatus.SENT,
      sentAt,
      renderedSubject: '[Popchor Mitglieder] Sommerfest',
      attachments: [],
    } as Prisma.SentEmailGetPayload<{ include: { attachments: true } }>);

    const result = await service.sendEmail(' [Popchor Mitglieder] Sommerfest ', 'Hallo zusammen', 'Viele Grüße', []);

    expect(mailService.sendInformationEmail).toHaveBeenCalledTimes(1);
    expect(prisma.member.findMany).toHaveBeenCalledWith({
      where: { isDisabled: false },
      select: { email: true },
    });
    expect(mailService.sendInformationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@choir.test',
        bcc: ['member@choir.test', 'other@choir.test'],
        subject: '[Popchor Mitglieder] Sommerfest',
        rawSubject: 'Sommerfest',
        markdownContent: 'Hallo zusammen',
        signatureMarkdown: 'Viele Grüße',
      }),
    );
    expect(result.subject).toBe('[Popchor Mitglieder] Sommerfest');
    expect(result.rawSubject).toBe('Sommerfest');
    expect(prisma.sentEmail.update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ renderedSubject: '[Popchor Mitglieder] Sommerfest' }),
    }));
  });

  it('stores attachment bytes and marks the email failed when sending fails', async () => {
    prisma.sentEmail.create.mockResolvedValue(sentEmailWithAttachments);
    prisma.member.findMany.mockResolvedValue([member('member@choir.test')]);
    mailService.sendInformationEmail.mockRejectedValue(new Error('SMTP unavailable'));
    prisma.sentEmail.update.mockResolvedValue({ ...sentEmail, status: SentEmailStatus.FAILED });
    const file = {
      originalname: 'Programm.pdf',
      mimetype: 'application/pdf',
      size: 3,
      buffer: Buffer.from('pdf'),
    } as Express.Multer.File;

    await expect(service.sendEmail('Sommerfest', 'Hallo', '', [file])).rejects.toThrow('SMTP unavailable');

    expect(prisma.sentEmail.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attachments: {
            create: [
              expect.objectContaining({
                filename: 'Programm.pdf',
                contentType: 'application/pdf',
                size: 3,
                content: new Uint8Array(Buffer.from('pdf')),
              }),
            ],
          },
        }),
      }),
    );
    expect(prisma.sentEmail.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: SentEmailStatus.FAILED } }),
    );
  });

  it('preserves Markdown whitespace for body and nonempty signature', async () => {
    const markdownContent = '  Intro\n\n```text\n  indented\n```\n';
    const signatureMarkdown = '\n**Viele Grüße**\n';
    prisma.sentEmail.create.mockResolvedValue(sentEmailWithAttachments);
    prisma.member.findMany.mockResolvedValue([member('member@choir.test')]);
    mailService.sendInformationEmail.mockResolvedValue('[Custom] Subject');
    prisma.sentEmail.update.mockResolvedValue({
      ...sentEmail,
      status: SentEmailStatus.SENT,
      sentAt: new Date(),
      renderedSubject: '[Custom] Subject',
      attachments: [],
    } as Prisma.SentEmailGetPayload<{ include: { attachments: true } }>);

    const result = await service.sendEmail('Subject', markdownContent, signatureMarkdown, []);

    expect(prisma.sentEmail.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ markdownContent, signatureMarkdown }),
      }),
    );
    expect(mailService.sendInformationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ markdownContent, signatureMarkdown, rawSubject: 'Subject' }),
    );
    expect(result.subject).toBe('[Custom] Subject');
  });

  it('rejects empty fields and oversized attachment sets before storing', async () => {
    await expect(service.sendEmail('  ', 'body', '', [])).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.sendEmail('subject', '  ', '', [])).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.sendEmail('subject', 'body', '', [
        { size: 20 * 1024 * 1024 + 1 } as Express.Multer.File,
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.sentEmail.create).not.toHaveBeenCalled();
  });

  it('exposes only successful messages and attachments', async () => {
    prisma.sentEmail.findFirst.mockResolvedValue(null);
    await expect(service.getSentEmail('failed-id')).rejects.toBeInstanceOf(NotFoundException);
    prisma.sentEmailAttachment.findFirst.mockResolvedValue(null);
    await expect(service.getAttachment('failed-id', 'attachment-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.sentEmail.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'failed-id', status: SentEmailStatus.SENT } }),
    );
    expect(prisma.sentEmailAttachment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'attachment-id',
          sentEmailId: 'failed-id',
          sentEmail: { status: SentEmailStatus.SENT },
        },
      }),
    );
  });
});
