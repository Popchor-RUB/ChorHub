import { Module } from '@nestjs/common';
import { MembersService } from './members.service';
import { MembersController } from './members.controller';
import { AuthModule } from '../auth/auth.module';
import { CheckinModule } from '../checkin/checkin.module';
import { MailModule } from '../mail/mail.module';
import { MemberStatusService } from './member-status.service';
import { DisableUnexcusedMembersTask } from './disable-unexcused-members.task';

@Module({
  imports: [AuthModule, CheckinModule, MailModule],
  providers: [MembersService, MemberStatusService, DisableUnexcusedMembersTask],
  controllers: [MembersController],
  exports: [MembersService, MemberStatusService],
})
export class MembersModule {}
