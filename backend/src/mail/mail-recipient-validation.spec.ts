import { Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { Test } from '@nestjs/testing';
import * as nodemailer from 'nodemailer';
import type { Member } from '../generated/prisma/client';
import { InvalidMailRecipientError } from '../common/invalid-mail-recipient.error';
import { MailService } from './mail.service';
import { MailTemplateService } from './mail-template.service';
import { PrismaService } from '../prisma/prisma.service';
import { mockDeep } from 'jest-mock-extended';

describe('MailService recipient validation', () => {
  const member: Member = {
    id: 'member-1', firstName: 'Anna', lastName: 'Müller', email: 'member@example.test',
    choirVoiceId: null, lastLoginAt: null, isDisabled: false, disabledAt: null,
    disableReason: null, internalComment: null, createdAt: new Date(), updatedAt: new Date(),
  };
  const mailer = { sendMail: jest.fn().mockResolvedValue(undefined) };
  let service: MailService;
  const prisma = mockDeep<PrismaService>();
  const message = {
    to: 'admin@example.test', bcc: ['member@example.test'], subject: 'News', rawSubject: 'News',
    markdownContent: 'Body', signatureMarkdown: '', attachments: [],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.member.findMany.mockResolvedValue([]);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const module = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailerService, useValue: mailer },
        { provide: MailTemplateService, useValue: {
          render: jest.fn().mockResolvedValue({ subject: 'News', html: '<p>Body</p>' }),
        } },
      ],
    }).compile();
    service = module.get(MailService);
  });

  afterEach(() => jest.restoreAllMocks());

  it.each(['invite', 'login', 'personal-info', 'reminder', 'test'])(
    'blocks %s mail after a queued recipient is disabled', async (kind) => {
      // The queued member snapshot is active; current database state wins.
      prisma.member.findMany.mockResolvedValue([{ ...member, isDisabled: true }]);
      let send: Promise<unknown>;
      switch (kind) {
        case 'invite':
          send = service.sendMemberInvite(member, 'https://choir.test/login');
          break;
        case 'login':
          send = service.sendMagicLink(member, 'https://choir.test/login', 'token', '123456');
          break;
        case 'personal-info':
          send = service.sendPersonalInfo(member, 'News', 'Body');
          break;
        case 'reminder':
          send = service.sendPushFallbackReminderMail({
            member, subject: 'News', title: 'Rehearsal', intro: 'Body', items: [],
            magicUrl: 'https://choir.test/login', showGenericLogin: true,
          });
          break;
        default:
          send = service.sendInformationEmail({ ...message, to: member.email, bcc: [] });
      }
      await expect(send).rejects.toBeInstanceOf(InvalidMailRecipientError);
      expect(prisma.member.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { isDisabled: true },
      }));
      expect(mailer.sendMail).not.toHaveBeenCalled();
    },
  );

  it('removes newly disabled BCC recipients immediately before SMTP', async () => {
    prisma.member.findMany.mockResolvedValue([{ ...member, isDisabled: true }]);
    await service.sendInformationEmail({
      ...message, bcc: [' MEMBER@Example.Test ', 'active@example.test'],
    });
    expect(mailer.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: message.to, bcc: ['active@example.test'],
    }));
  });

  it.each([false, true])('keeps disable notices deliverable when automatic=%s', async (automatic) => {
    prisma.member.findMany.mockResolvedValue([{ ...member, isDisabled: true }]);
    await service.sendMemberDisabledMail({
      to: member.email, firstName: member.firstName, adminEmail: message.to, automatic,
    });
    expect(mailer.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: member.email }));
    expect(prisma.member.findMany).not.toHaveBeenCalled();
  });

  it('fails closed when current recipient status cannot be read', async () => {
    prisma.member.findMany.mockRejectedValueOnce(new Error('Database unavailable'));
    await expect(service.sendPersonalInfo(member, 'News', 'Body')).rejects.toThrow('Database unavailable');
    expect(mailer.sendMail).not.toHaveBeenCalled();
  });

  it.each([
    'member@example.test,external@example.test',
    'Choir: member@example.test,external@example.test;',
    'Anna <member@example.test>',
    'member@example.test\r\nBcc: external@example.test',
    'broken-address',
  ])('blocks legacy malformed recipient %s in individual mail paths', async (email) => {
    const unsafeMember = { ...member, email };
    await expect(service.sendMemberInvite(unsafeMember, 'https://choir.test/login'))
      .rejects.toBeInstanceOf(InvalidMailRecipientError);
    await expect(service.sendMagicLink(unsafeMember, 'https://choir.test/login', 'token', '123456'))
      .rejects.toBeInstanceOf(InvalidMailRecipientError);
    await expect(service.sendPersonalInfo(unsafeMember, 'News', 'Body'))
      .rejects.toBeInstanceOf(InvalidMailRecipientError);
    expect(mailer.sendMail).not.toHaveBeenCalled();
  });

  it.each(['to', 'bcc'] as const)('rejects entire bulk send when %s contains a stored list', async (field) => {
    const list = 'member@example.test,external@example.test';
    const unsafeMessage = field === 'to'
      ? { ...message, to: list }
      : { ...message, bcc: ['valid@example.test', list] };
    await expect(service.sendInformationEmail(unsafeMessage))
      .rejects.toBeInstanceOf(InvalidMailRecipientError);
    expect(mailer.sendMail).not.toHaveBeenCalled();
  });

  it('normalizes legitimate recipients and preserves BCC delivery', async () => {
    await service.sendInformationEmail({
      ...message, to: ' ADMIN@Example.Test ', bcc: [' Member+choir@Example.Test ', 'other@example.test'],
    });
    expect(mailer.sendMail).toHaveBeenCalledTimes(1);
    expect(mailer.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'admin@example.test', bcc: ['member+choir@example.test', 'other@example.test'],
    }));
  });

  it('passes exactly the intended mailboxes to the installed Nodemailer transport', async () => {
    const transport = nodemailer.createTransport({ jsonTransport: true });
    let envelopeRecipients: string[] = [];
    mailer.sendMail.mockImplementationOnce(async (options: Pick<nodemailer.SendMailOptions, 'to' | 'bcc' | 'subject' | 'html' | 'attachments'>) => {
      const result = await transport.sendMail(options);
      envelopeRecipients = result.envelope.to;
      return result;
    });

    await service.sendInformationEmail({
      ...message, bcc: ['member+choir@example.test', "o'connor@example.test"],
    });
    expect(envelopeRecipients).toEqual([
      'admin@example.test', 'member+choir@example.test', "o'connor@example.test",
    ]);
  });
});
