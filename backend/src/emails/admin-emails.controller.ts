import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';
import { sendEmailAttachmentResponse } from './email-attachment-response';
import { EmailsService } from './emails.service';

const MAX_ATTACHMENT_COUNT = 10;
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;

interface CreateEmailBody {
  subject: string;
  markdownContent: string;
  signatureMarkdown?: string;
}

@Controller('admin/emails')
@UseGuards(JwtAdminGuard)
export class AdminEmailsController {
  constructor(private readonly emailsService: EmailsService) {}

  @Get()
  listSentEmails() {
    return this.emailsService.listSentEmails();
  }

  @Get(':id')
  getSentEmail(@Param('id') id: string) {
    return this.emailsService.getSentEmail(id);
  }

  @Post()
  @UseInterceptors(
    FilesInterceptor('attachments', MAX_ATTACHMENT_COUNT, {
      limits: { fileSize: MAX_ATTACHMENT_SIZE, files: MAX_ATTACHMENT_COUNT },
    }),
  )
  sendEmail(
    @Body() body: CreateEmailBody,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    return this.emailsService.sendEmail(
      body.subject,
      body.markdownContent,
      body.signatureMarkdown,
      files,
    );
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
