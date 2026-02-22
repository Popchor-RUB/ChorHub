import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { Member } from '@prisma/client';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendMagicLink(member: Member, magicUrl: string): Promise<void> {
    await this.mailerService.sendMail({
      to: member.email,
      subject: 'Ihr Anmeldelink für ChorHub',
      template: 'magic-link',
      context: {
        firstName: member.firstName,
        magicUrl,
      },
    });
  }

  async sendMemberInvite(member: Member, magicUrl: string): Promise<void> {
    await this.mailerService.sendMail({
      to: member.email,
      subject: 'Willkommen bei ChorHub – Ihr persönlicher Zugangslink',
      template: 'invite',
      context: {
        firstName: member.firstName,
        lastName: member.lastName,
        magicUrl,
      },
    });
  }
}
