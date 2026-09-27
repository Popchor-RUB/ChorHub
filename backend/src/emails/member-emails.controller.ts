import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { MemberTokenGuard } from '../auth/guards/member-token.guard';
import { sendEmailAttachmentResponse } from './email-attachment-response';
import { EmailsService } from './emails.service';

@Controller('emails')
@UseGuards(MemberTokenGuard)
export class MemberEmailsController {
  constructor(private readonly emailsService: EmailsService) {}

  @Get()
  listSentEmails() {
    return this.emailsService.listSentEmails();
  }

  @Get(':id')
  getSentEmail(@Param('id') id: string) {
    return this.emailsService.getSentEmail(id);
  }

  @Get(':id/attachments/:attachmentId')
  async downloadAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Res() response: Response,
  ): Promise<void> {
    const attachment = await this.emailsService.getAttachment(id, attachmentId);
    sendEmailAttachmentResponse(attachment, response);
  }
}
