import { Module } from '@nestjs/common';
import { PushService } from './push.service';
import { PushController } from './push.controller';
import { RehearsalReminderTask } from './rehearsal-reminder.task';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [PrismaModule, AuthModule, MailModule],
  providers: [PushService, RehearsalReminderTask],
  controllers: [PushController],
  exports: [PushService],
})
export class PushModule {}
