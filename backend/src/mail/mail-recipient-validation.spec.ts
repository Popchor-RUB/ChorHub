import { Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { Test } from '@nestjs/testing';
import * as nodemailer from 'nodemailer';
import type { Member } from '../generated/prisma/client';
import { InvalidMailRecipientError } from '../common/invalid-mail-recipient.error';
import { MailService } from './mail.service';
import { MailTemplateService } from './mail-template.service';

describe('MailService recipient validation', () => {
  const member: Member = {
    id: 'member-1', firstName: 'Anna', lastName: 'Müller', email: 'member@example.test',
    choirVoiceId: null, lastLoginAt: null, isDisabled: false, disabledAt: null,
    disableReason: null, internalComment: null, createdAt: new Date(), updatedAt: new Date(),
  };
  const mailer = { sendMail: jest.fn().mockResolvedValue(undefined) };
  let service: MailService;
  const message = {
    to: 'admin@example.test', bcc: ['member@example.test'], subject: 'News', rawSubject: 'News',
    markdownContent: 'Body', signatureMarkdown: '', attachments: [],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const module = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: MailerService, useValue: mailer },
        { provide: MailTemplateService, useValue: {
          render: jest.fn().mockResolvedValue({ subject: 'News', html: '<p>Body</p>' }),
        } },
      ],
    }).compile();
    service = module.get(MailService);
  });

  afterEach(() => jest.restoreAllMocks());

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
