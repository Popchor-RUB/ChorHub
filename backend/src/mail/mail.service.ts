import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { Member } from '../generated/prisma/client';

export interface PushFallbackReminderItem {
  label: string;
  confirmUrl?: string;
  declineUrl?: string;
}

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

  async sendPushFallbackReminderMail(params: {
    member: Member;
    subject: string;
    title: string;
    intro: string;
    items: PushFallbackReminderItem[];
    question?: string;
    magicUrl: string;
    showGenericLogin: boolean;
  }): Promise<void> {
    await this.mailerService.sendMail({
      to: params.member.email,
      subject: params.subject,
      template: 'push-fallback-reminder',
      context: {
        firstName: params.member.firstName,
        title: params.title,
        intro: params.intro,
        items: params.items,
        question: params.question,
        magicUrl: params.magicUrl,
        showGenericLogin: params.showGenericLogin,
      },
    });
  }
}
