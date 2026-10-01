import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import MarkdownIt from 'markdown-it';
import type { Member } from '../generated/prisma/client';
import type { SentEmailAttachment } from '../generated/prisma/client';
import { MailTemplateService } from './mail-template.service';
import type { MailTemplateKey } from './mail-template.types';
import { requireSingleMailbox } from '../common/single-mailbox';

export interface PushFallbackReminderItem {
  label: string;
  confirmUrl?: string;
  declineUrl?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly markdownRenderer: MarkdownIt;

  constructor(
    private readonly mailerService: MailerService,
    private readonly templateService: MailTemplateService,
  ) {
    this.markdownRenderer = new MarkdownIt({ breaks: true, html: false, linkify: true });
  }

  async sendMagicLink(member: Member, magicUrl: string, rawToken: string, loginCode: string): Promise<void> {
    const { subject, html } = await this.templateService.render('magic-link', {
      firstName: member.firstName,
      magicUrl,
      rawToken,
      loginCode,
    });
    await this.sendMail('magic-link', { to: member.email, subject, html });
  }

  async sendMemberInvite(member: Member, magicUrl: string): Promise<void> {
    const { subject, html } = await this.templateService.render('invite', {
      firstName: member.firstName,
      lastName: member.lastName,
      magicUrl,
    });
    await this.sendMail('invite', { to: member.email, subject, html });
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
    const { subject, html } = await this.templateService.render('push-fallback-reminder', {
      firstName: params.member.firstName,
      subject: params.subject,
      title: params.title,
      intro: params.intro,
      items: params.items.map((item) => ({
        label: item.label,
        confirmUrl: item.confirmUrl ?? '',
        declineUrl: item.declineUrl ?? '',
      })),
      question: params.question ?? '',
      magicUrl: params.magicUrl,
      showGenericLogin: params.showGenericLogin,
    });
    await this.sendMail('push-fallback-reminder', { to: params.member.email, subject, html });
  }

  async sendPersonalInfo(member: Member, subjectInput: string, markdownContent: string): Promise<void> {
    const htmlContent = this.renderMarkdownToHtml(markdownContent);
    const { subject, html } = await this.templateService.render('personal-info', {
      firstName: member.firstName ?? '',
      subject: subjectInput,
      rawSubject: subjectInput,
      htmlContent,
      htmlSignature: '',
      markdownContent,
      signatureMarkdown: '',
    });
    await this.sendMail('personal-info', { to: member.email, subject, html });
  }

  async sendInformationEmail(params: {
    to: string;
    bcc: string[];
    subject: string;
    rawSubject: string;
    markdownContent: string;
    signatureMarkdown: string;
    attachments: Array<Pick<SentEmailAttachment, 'filename' | 'contentType' | 'content'>>;
  }): Promise<string> {
    const htmlContent = this.renderMarkdownToHtml(params.markdownContent);
    const htmlSignature = params.signatureMarkdown
      ? this.renderMarkdownToHtml(params.signatureMarkdown)
      : '';
    const { subject, html } = await this.templateService.render('personal-info', {
      firstName: '',
      subject: params.subject,
      rawSubject: params.rawSubject,
      htmlContent,
      htmlSignature,
      markdownContent: params.markdownContent,
      signatureMarkdown: params.signatureMarkdown,
    });

    await this.sendMail('personal-info', {
      to: params.to,
      bcc: params.bcc,
      subject,
      html,
      attachments: params.attachments.map((attachment) => ({
        filename: attachment.filename,
        contentType: attachment.contentType,
        content: Buffer.from(attachment.content),
      })),
    });
    return subject;
  }

  async sendMemberDisabledMail(params: {
    to: string;
    firstName: string;
    adminEmail: string;
    automatic?: boolean;
    reason?: string | null;
  }): Promise<void> {
    const templateKey = params.automatic ? 'member-automatically-disabled' : 'member-disabled';
    const context: Record<string, unknown> = {
      firstName: params.firstName,
      adminEmail: params.adminEmail,
    };
    if (!params.automatic) {
      context.reason = params.reason?.trim() ?? '';
    }
    const { subject, html } = await this.templateService.render(templateKey, context);
    await this.sendMail(templateKey, { to: params.to, subject, html });
  }

  async sendAdminMemberDisabledMail(params: {
    to: string;
    firstName: string;
    lastName: string;
    memberEmail: string;
    reason: string | null;
  }): Promise<void> {
    const { subject, html } = await this.templateService.render('admin-member-disabled', {
      firstName: params.firstName,
      lastName: params.lastName,
      memberEmail: params.memberEmail,
      reason: params.reason ?? '',
    });
    await this.sendMail('admin-member-disabled', { to: params.to, subject, html });
  }

  private async sendMail(
    template: MailTemplateKey,
    options: Pick<Parameters<MailerService['sendMail']>[0], 'subject' | 'html' | 'attachments'> & {
      to: string;
      bcc?: string[];
    },
  ): Promise<void> {
    try {
      const to = requireSingleMailbox(options.to);
      const bcc = options.bcc?.map(requireSingleMailbox);
      await this.mailerService.sendMail({ ...options, to, ...(bcc ? { bcc } : {}) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send email (template: ${template}): ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private renderMarkdownToHtml(markdownContent: string): string {
    return this.markdownRenderer.render(markdownContent);
  }
}
