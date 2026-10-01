import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
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
import { EMAIL_UPLOAD_OPTIONS } from '../common/multipart-upload-options';
import { SentEmailKind } from '../generated/prisma/client';
import { sendEmailAttachmentResponse } from './email-attachment-response';
import { CreateEmailDto } from './dto/create-email.dto';
import { RetryEmailDto } from './dto/retry-email.dto';
import { EmailsService } from './emails.service';

const MAX_ATTACHMENT_COUNT = 10;

@Controller('admin/emails')
@UseGuards(JwtAdminGuard)
export class AdminEmailsController {
  constructor(private readonly emailsService: EmailsService) {}

  @Get('jobs')
  listJobs() {
    return this.emailsService.listJobs();
  }

  @Get('jobs/:id')
  getJob(@Param('id') id: string) {
    return this.emailsService.getJob(id);
  }

  @Post('jobs/:id/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  retryJob(
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() body: RetryEmailDto = {},
  ) {
    return this.emailsService.retryJob(id, idempotencyKey, body.acknowledgeDuplicateRisk === true);
  }

  @Get()
  listSentEmails() {
    return this.emailsService.listSentEmails();
  }

  @Get(':id')
  getSentEmail(@Param('id') id: string) {
    return this.emailsService.getSentEmail(id);
  }

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(
    FilesInterceptor('attachments', MAX_ATTACHMENT_COUNT, EMAIL_UPLOAD_OPTIONS),
  )
  sendEmail(
    @Body() body: CreateEmailDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    return this.emailsService.enqueueEmail(
      SentEmailKind.BULK,
      body.subject,
      body.markdownContent,
      body.signatureMarkdown,
      files,
      idempotencyKey,
    );
  }

  @Post('test')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(
    FilesInterceptor('attachments', MAX_ATTACHMENT_COUNT, EMAIL_UPLOAD_OPTIONS),
  )
  sendTestEmail(
    @Body() body: CreateEmailDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    return this.emailsService.enqueueEmail(
      SentEmailKind.TEST,
      body.subject,
      body.markdownContent,
      body.signatureMarkdown,
      files,
      idempotencyKey,
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
