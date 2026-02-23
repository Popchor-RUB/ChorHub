import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MembersModule } from './members/members.module';
import { RehearsalsModule } from './rehearsals/rehearsals.module';
import { AttendanceModule } from './attendance/attendance.module';
import { AdminModule } from './admin/admin.module';
import { GeneralInfoModule } from './general-info/general-info.module';
import { MailModule } from './mail/mail.module';
import { PushModule } from './push/push.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    MailModule,
    AuthModule,
    MembersModule,
    RehearsalsModule,
    AttendanceModule,
    AdminModule,
    GeneralInfoModule,
    PushModule,
  ],
})
export class AppModule {}
