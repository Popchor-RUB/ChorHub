import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import MarkdownIt from 'markdown-it';
import { Member } from '../generated/prisma/client';

export interface PushFallbackReminderItem {
  label: string;
  confirmUrl?: string;
  declineUrl?: string;
}

@Injectable()
export class MailService {
  private readonly markdownRenderer: MarkdownIt;

  constructor(private readonly mailerService: MailerService) {
    this.markdownRenderer = new MarkdownIt({
      breaks: true,
      html: false,
      linkify: true,
    });
  }

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

  async sendPersonalInfo(member: Member, subject: string, markdownContent: string): Promise<void> {
    const htmlContent = this.renderMarkdownToHtml(markdownContent);

    await this.mailerService.sendMail({
      to: member.email,
      subject,
      template: 'personal-info',
      context: {
        firstName: member.firstName,
        subject,
        htmlContent,
        markdownContent,
      },
    });
  }

  private renderMarkdownToHtml(markdownContent: string): string {
    return this.markdownRenderer.render(markdownContent);
  }
}
