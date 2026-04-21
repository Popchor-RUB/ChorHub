import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { PersonalInfoService } from './personal-info.service';
import { PersonalInfoController } from './personal-info.controller';
import { AdminPersonalInfoController } from './admin-personal-info.controller';

@Module({
  imports: [
    AuthModule,
    MailModule,
    MulterModule.register({ limits: { fileSize: 5 * 1024 * 1024 } }),
  ],
  providers: [PersonalInfoService],
  controllers: [PersonalInfoController, AdminPersonalInfoController],
})
export class PersonalInfoModule {}
