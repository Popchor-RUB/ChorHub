import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { AdminEmailsController } from './admin-emails.controller';
import { EmailsService } from './emails.service';
import { EmailJobsWorker } from './email-jobs.worker';
import { MemberEmailsController } from './member-emails.controller';

@Module({
  imports: [AuthModule, MailModule],
  controllers: [AdminEmailsController, MemberEmailsController],
  providers: [EmailsService, EmailJobsWorker],
})
export class EmailsModule {}
