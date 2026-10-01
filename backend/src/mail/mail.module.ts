import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { SendMailOptions, TransportOptions } from 'nodemailer';
import { MailService } from './mail.service';
import { MailQueueService } from './mail-queue.service';
import { MailTemplateService } from './mail-template.service';

function parseBooleanEnv(value: string | undefined, fallback = false): boolean {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const smtpSecure = parseBooleanEnv(config.get<string>('SMTP_SECURE'), false);
        // Mailer still types message defaults as transport options. Nodemailer 10
        // separates them, so expose both types at this compatibility boundary.
        const defaults: SendMailOptions & TransportOptions = {
          from: config.get<string>('MAIL_FROM', 'noreply@chorhub.de'),
        };
        return {
          transport: {
            host: config.get<string>('SMTP_HOST'),
            port: Number(config.get<string>('SMTP_PORT') ?? 587),
            secure: smtpSecure,
            // With secure=false nodemailer still attempts STARTTLS by default.
            // Keep TLS fully disabled unless SMTP_SECURE is explicitly enabled.
            ignoreTLS: !smtpSecure,
            auth:
              config.get('SMTP_USER')
                ? {
                    user: config.get<string>('SMTP_USER'),
                    pass: config.get<string>('SMTP_PASS'),
                  }
                : undefined,
          },
          defaults,
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [MailService, MailQueueService, MailTemplateService],
  exports: [MailService, MailQueueService, MailTemplateService],
})
export class MailModule {}
