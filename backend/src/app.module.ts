import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MembersModule } from './members/members.module';
import { RehearsalsModule } from './rehearsals/rehearsals.module';
import { AttendanceModule } from './attendance/attendance.module';
import { AdminModule } from './admin/admin.module';
import { GeneralInfoModule } from './general-info/general-info.module';
import { MailModule } from './mail/mail.module';
import { PushModule } from './push/push.module';
import { GlobalAuthGuard } from './auth/guards/global-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
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
  providers: [
    { provide: APP_GUARD, useClass: GlobalAuthGuard },
  ],
})
export class AppModule {}
