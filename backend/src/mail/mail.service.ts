import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import MarkdownIt from 'markdown-it';
import { Member } from '../generated/prisma/client';
import type { SentEmailAttachment } from '../generated/prisma/client';

export interface PushFallbackReminderItem {
  label: string;
  confirmUrl?: string;
  declineUrl?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly markdownRenderer: MarkdownIt;
  private readonly appUrl: string;

  constructor(
    private readonly mailerService: MailerService,
    config: ConfigService,
  ) {
    this.appUrl = config.getOrThrow<string>('APP_URL');
    this.markdownRenderer = new MarkdownIt({
      breaks: true,
      html: false,
      linkify: true,
    });
  }

  async sendMagicLink(member: Member, magicUrl: string, rawToken: string, loginCode: string): Promise<void> {
    await this.sendMail({
      to: member.email,
      subject: 'Dein ChorHub Anmeldelink',
      template: 'magic-link',
      context: {
        firstName: member.firstName,
        magicUrl,
        rawToken,
        loginCode,
        appUrl: this.appUrl,
      },
    });
  }

  async sendMemberInvite(member: Member, magicUrl: string): Promise<void> {
    await this.sendMail({
      to: member.email,
      subject: 'Willkommen bei ChorHub – Dein Zugangslink',
      template: 'invite',
      context: {
        firstName: member.firstName,
        lastName: member.lastName,
        magicUrl,
        appUrl: this.appUrl,
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
    await this.sendMail({
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
        appUrl: this.appUrl,
      },
    });
  }

  async sendPersonalInfo(member: Member, subject: string, markdownContent: string): Promise<void> {
    const htmlContent = this.renderMarkdownToHtml(markdownContent);

    await this.sendMail({
      to: member.email,
      subject,
      template: 'personal-info',
      context: {
        firstName: member.firstName,
        subject,
        htmlContent,
        htmlSignature: '',
        markdownContent,
        appUrl: this.appUrl,
      },
    });
  }

  async sendInformationEmail(params: {
    to: string;
    bcc: string[];
    subject: string;
    markdownContent: string;
    signatureMarkdown: string;
    attachments: Array<Pick<SentEmailAttachment, 'filename' | 'contentType' | 'content'>>;
  }): Promise<void> {
    const htmlContent = this.renderMarkdownToHtml(params.markdownContent);
    const htmlSignature = params.signatureMarkdown
      ? this.renderMarkdownToHtml(params.signatureMarkdown)
      : '';

    await this.sendMail({
      to: params.to,
      bcc: params.bcc,
      subject: params.subject,
      template: 'personal-info',
      context: {
        subject: params.subject,
        htmlContent,
        htmlSignature,
        signatureMarkdown: params.signatureMarkdown,
        appUrl: this.appUrl,
      },
      attachments: params.attachments.map((attachment) => ({
        filename: attachment.filename,
        contentType: attachment.contentType,
        content: Buffer.from(attachment.content),
      })),
    });
  }

  async sendMemberDisabledMail(params: { to: string; firstName: string; adminEmail: string }): Promise<void> {
    await this.sendMail({
      to: params.to,
      subject: 'Dein ChorHub Zugang wurde deaktiviert',
      template: 'member-disabled',
      context: { firstName: params.firstName, adminEmail: params.adminEmail, appUrl: this.appUrl },
    });
  }

  async sendAdminMemberDisabledMail(params: {
    to: string;
    firstName: string;
    lastName: string;
    memberEmail: string;
    reason: string | null;
  }): Promise<void> {
    await this.sendMail({
      to: params.to,
      subject: `ChorHub Mitglied deaktiviert: ${params.firstName} ${params.lastName}`,
      template: 'admin-member-disabled',
      context: { ...params, appUrl: this.appUrl },
    });
  }

  private async sendMail(options: Parameters<MailerService['sendMail']>[0]): Promise<void> {
    try {
      await this.mailerService.sendMail(options);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send email (template: ${options.template}): ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private renderMarkdownToHtml(markdownContent: string): string {
    return this.markdownRenderer.render(markdownContent);
  }
}
