import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { AuthModule } from '../auth/auth.module';
import { CheckinModule } from '../checkin/checkin.module';
import { AdminModule } from '../admin/admin.module';
import { VoiceAdminController } from './voice-admin.controller';
import { VoiceAdminService } from './voice-admin.service';

@Module({
  imports: [AuthModule, CheckinModule, AdminModule],
  providers: [AttendanceService, VoiceAdminService],
  controllers: [AttendanceController, VoiceAdminController],
})
export class AttendanceModule {}
