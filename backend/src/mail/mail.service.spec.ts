import { Test } from '@nestjs/testing';
import { MailerService } from '@nestjs-modules/mailer';
import { MailService } from './mail.service';

describe('MailService', () => {
  it('sends personal info email with template and context', async () => {
    const mailerService = {
      sendMail: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<MailerService>;

    const module = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: MailerService, useValue: mailerService },
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

    expect(mailerService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'anna@choir.de',
        subject: 'Betreff',
        template: 'personal-info',
        context: expect.objectContaining({
          firstName: 'Anna',
          subject: 'Betreff',
          htmlContent: '<p>Markdown Nachricht</p>\n',
        }),
      }),
    );
  });

  it('renders admin email body and signature and sends attachments in one message', async () => {
    const mailerService = {
      sendMail: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<MailerService>;
    const module = await Test.createTestingModule({
      providers: [MailService, { provide: MailerService, useValue: mailerService }],
    }).compile();
    const service = module.get(MailService);

    await service.sendInformationEmail({
      to: 'admin@choir.test',
      bcc: ['member@choir.test'],
      subject: '[Popchor Mitglieder] Hallo',
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

    expect(mailerService.sendMail).toHaveBeenCalledTimes(1);
    expect(mailerService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@choir.test',
        bcc: ['member@choir.test'],
        subject: '[Popchor Mitglieder] Hallo',
        template: 'personal-info',
        context: expect.objectContaining({
          htmlContent: '<p><strong>Nachricht</strong></p>\n',
          htmlSignature: '<p><em>Viele Grüße</em></p>\n',
        }),
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
