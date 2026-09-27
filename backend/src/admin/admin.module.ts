import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { MembersModule } from '../members/members.module';

@Module({
  imports: [
    AuthModule,
    MailModule,
    MembersModule,
    MulterModule.register({ limits: { fileSize: 5 * 1024 * 1024 } }), // 5MB max
  ],
  providers: [AdminService],
  controllers: [AdminController],
  exports: [AdminService],
})
export class AdminModule {}
