import { Module } from '@nestjs/common';
import { CheckinService } from './checkin.service';

@Module({
  providers: [CheckinService],
  exports: [CheckinService],
})
export class CheckinModule {}

