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
      } as any,
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
});
