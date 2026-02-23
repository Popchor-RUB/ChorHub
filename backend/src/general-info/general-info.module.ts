import { Module } from '@nestjs/common';
import { GeneralInfoService } from './general-info.service';
import { GeneralInfoController } from './general-info.controller';
import { AuthModule } from '../auth/auth.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [AuthModule, PushModule],
  providers: [GeneralInfoService],
  controllers: [GeneralInfoController],
})
export class GeneralInfoModule {}
