import { Module } from '@nestjs/common';
import { GeneralInfoService } from './general-info.service';
import { GeneralInfoController } from './general-info.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [GeneralInfoService],
  controllers: [GeneralInfoController],
})
export class GeneralInfoModule {}
