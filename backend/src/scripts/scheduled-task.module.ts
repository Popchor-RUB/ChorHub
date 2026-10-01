import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { DisableUnexcusedMembersTask } from '../members/disable-unexcused-members.task';
import { MemberStatusService } from '../members/member-status.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PushService } from '../push/push.service';
import { RehearsalReminderTask } from '../push/rehearsal-reminder.task';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    PrismaModule,
    MailModule,
    AuthModule,
  ],
  providers: [PushService, RehearsalReminderTask, MemberStatusService, DisableUnexcusedMembersTask],
})
export class ScheduledTaskModule {}
