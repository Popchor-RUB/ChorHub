import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { Member } from '../generated/prisma/client';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendMagicLink(member: Member, magicUrl: string, rawToken: string, loginCode: string): Promise<void> {
    await this.mailerService.sendMail({
      to: member.email,
      subject: 'Dein ChorHub Anmeldelink',
      template: 'magic-link',
      context: {
        firstName: member.firstName,
        magicUrl,
        rawToken,
        loginCode,
      },
    });
  }

  async sendMemberInvite(member: Member, magicUrl: string): Promise<void> {
    await this.mailerService.sendMail({
      to: member.email,
      subject: 'Willkommen bei ChorHub – Dein Zugangslink',
      template: 'invite',
      context: {
        firstName: member.firstName,
        lastName: member.lastName,
        magicUrl,
      },
    });
  }
}
