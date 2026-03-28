import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { MailService } from './mail.service';

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
          defaults: {
            from: config.get<string>('MAIL_FROM', 'noreply@chorhub.de'),
          },
          template: {
            dir: join(__dirname, 'templates'),
            adapter: new HandlebarsAdapter(),
            options: { strict: true },
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
