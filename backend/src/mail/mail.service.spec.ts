import { Test } from '@nestjs/testing';
import { MailerService } from '@nestjs-modules/mailer';
import { MailService } from './mail.service';
import { MailTemplateService } from './mail-template.service';

describe('MailService', () => {
  it('sends personal info email with template and context', async () => {
    const mailerService = {
      sendMail: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<MailerService>;
    const templateService = {
      render: jest.fn().mockResolvedValue({ subject: 'Betreff', html: '<p>rendered</p>' }),
    };

    const module = await Test.createTestingModule({
      providers: [
        MailService,
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
    } as unknown as jest.Mocked<MailerService>;
    const templateService = {
      render: jest.fn().mockResolvedValue({ subject: '[Popchor Mitglieder] Hallo', html: '<p>rendered</p>' }),
    };
    const module = await Test.createTestingModule({
      providers: [MailService, { provide: MailerService, useValue: mailerService }, { provide: MailTemplateService, useValue: templateService }],
    }).compile();
    const service = module.get(MailService);

    await service.sendInformationEmail({
      to: 'admin@choir.test',
      bcc: ['member@choir.test'],
      subject: '[Popchor Mitglieder] Hallo',
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
