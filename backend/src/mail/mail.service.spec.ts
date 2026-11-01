import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MailerService } from '@nestjs-modules/mailer';
import { MailService } from './mail.service';
import { MailTemplateService } from './mail-template.service';
import { PrismaService } from '../prisma/prisma.service';
import { mockDeep } from 'jest-mock-extended';

describe('MailService', () => {
  const prisma = mockDeep<PrismaService>();

  beforeEach(() => {
    prisma.member.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    { automatic: undefined, templateKey: 'member-disabled' },
    { automatic: false, templateKey: 'member-disabled' },
    { automatic: true, templateKey: 'member-automatically-disabled' },
  ])('sends member disable mail using $templateKey when automatic=$automatic', async ({ automatic, templateKey }) => {
    const mailerService = { sendMail: jest.fn().mockResolvedValue(undefined) };
    const templateService = {
      render: jest.fn().mockResolvedValue({ subject: 'Disabled', html: '<p>disabled</p>' }),
    };
    const module = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailerService, useValue: mailerService },
        { provide: MailTemplateService, useValue: templateService },
      ],
    }).compile();
    const service = module.get(MailService);

    await service.sendMemberDisabledMail({
      to: 'member@choir.test',
      firstName: 'Anna',
      adminEmail: 'admin@choir.test',
      automatic,
    });

    expect(templateService.render).toHaveBeenCalledWith(templateKey, automatic
      ? { firstName: 'Anna', adminEmail: 'admin@choir.test' }
      : { firstName: 'Anna', adminEmail: 'admin@choir.test', reason: '' });
    expect(mailerService.sendMail).toHaveBeenCalledWith({
      to: 'member@choir.test',
      subject: 'Disabled',
      html: '<p>disabled</p>',
    });
  });

  it('trims manual disable reason and never exposes automatic reason', async () => {
    const mailerService = { sendMail: jest.fn().mockResolvedValue(undefined) };
    const templateService = {
      render: jest.fn().mockResolvedValue({ subject: 'Disabled', html: '<p>disabled</p>' }),
    };
    const module = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailerService, useValue: mailerService },
        { provide: MailTemplateService, useValue: templateService },
      ],
    }).compile();
    const service = module.get(MailService);

    await service.sendMemberDisabledMail({
      to: 'member@choir.test', firstName: 'Anna', adminEmail: 'admin@choir.test', reason: '  Respectful reason  ',
    });
    await service.sendMemberDisabledMail({
      to: 'member@choir.test', firstName: 'Anna', adminEmail: 'admin@choir.test', automatic: true, reason: 'private reason',
    });

    expect(templateService.render).toHaveBeenNthCalledWith(1, 'member-disabled', {
      firstName: 'Anna', adminEmail: 'admin@choir.test', reason: 'Respectful reason',
    });
    expect(templateService.render).toHaveBeenNthCalledWith(2, 'member-automatically-disabled', {
      firstName: 'Anna', adminEmail: 'admin@choir.test',
    });
  });

  it.each([new Error('SMTP connection failed'), 'SMTP connection failed'])(
    'logs send failures and rethrows the original error: %s',
    async (error) => {
      const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
      const mailerService = {
        sendMail: jest.fn().mockRejectedValue(error),
      };
      const module = await Test.createTestingModule({
        providers: [
          MailService,
          { provide: PrismaService, useValue: prisma },
          { provide: MailerService, useValue: mailerService },
          { provide: MailTemplateService, useValue: { render: jest.fn().mockResolvedValue({ subject: 'Disabled', html: '<p>disabled</p>' }) } },
        ],
      }).compile();
      const service = module.get(MailService);

      await expect(
        service.sendMemberDisabledMail({
          to: 'member@choir.test',
          firstName: 'Anna',
          adminEmail: 'admin@choir.test',
        }),
      ).rejects.toBe(error);

      expect(logError).toHaveBeenCalledTimes(1);
      expect(logError).toHaveBeenCalledWith(
        'Failed to send email (template: member-disabled): SMTP connection failed',
        error instanceof Error ? error.stack : undefined,
      );
    },
  );

  it('sends personal info email with template and context', async () => {
    const mailerService = {
      sendMail: jest.fn().mockResolvedValue(undefined),
    };
    const templateService = {
      render: jest.fn().mockResolvedValue({ subject: 'Betreff', html: '<p>rendered</p>' }),
    };

    const module = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailerService, useValue: mailerService },
        { provide: MailTemplateService, useValue: templateService },
      ],
    }).compile();

    const service = module.get(MailService);

    await service.sendPersonalInfo(
      {
        id: 'm-1',
        firstName: 'Anna',
        lastName: 'Müller',
        email: 'anna@choir.de',
        choirVoiceId: null,
        lastLoginAt: null,
        isDisabled: false,
        disabledAt: null,
        disableReason: null,
        internalComment: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      'Betreff',
      'Markdown Nachricht',
    );

    expect(templateService.render).toHaveBeenCalledWith('personal-info', expect.objectContaining({
      firstName: 'Anna',
      subject: 'Betreff',
      rawSubject: 'Betreff',
      htmlContent: '<p>Markdown Nachricht</p>\n',
    }));
    expect(mailerService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'anna@choir.de',
        subject: 'Betreff',
        html: '<p>rendered</p>',
      }),
    );
  });

  it('renders admin email body and signature and sends attachments in one message', async () => {
    const mailerService = {
      sendMail: jest.fn().mockResolvedValue(undefined),
    };
    const templateService = {
      render: jest.fn().mockResolvedValue({ subject: '[Popchor Mitglieder] Hallo', html: '<p>rendered</p>' }),
    };
    const module = await Test.createTestingModule({
      providers: [MailService, { provide: PrismaService, useValue: prisma }, { provide: MailerService, useValue: mailerService }, { provide: MailTemplateService, useValue: templateService }],
    }).compile();
    const service = module.get(MailService);

    const subject = await service.sendInformationEmail({
      to: 'admin@choir.test',
      bcc: ['member@choir.test'],
      subject: 'Hallo',
      rawSubject: 'Hallo',
      markdownContent: '**Nachricht**',
      signatureMarkdown: '_Viele Grüße_',
      attachments: [
        {
          filename: 'plan.pdf',
          contentType: 'application/pdf',
          content: new Uint8Array([1, 2, 3]),
        },
      ],
    });

    expect(templateService.render).toHaveBeenCalledWith('personal-info', expect.objectContaining({
      subject: 'Hallo', rawSubject: 'Hallo',
    }));
    expect(subject).toBe('[Popchor Mitglieder] Hallo');
    expect(mailerService.sendMail).toHaveBeenCalledTimes(1);
    expect(mailerService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@choir.test',
        bcc: ['member@choir.test'],
        subject: '[Popchor Mitglieder] Hallo',
        html: '<p>rendered</p>',
        attachments: [
          expect.objectContaining({
            filename: 'plan.pdf',
            contentType: 'application/pdf',
            content: Buffer.from([1, 2, 3]),
          }),
        ],
      }),
    );
  });
});
