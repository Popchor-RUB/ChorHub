import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LocalAdminStrategy } from './strategies/local-admin.strategy';
import { JwtAdminStrategy } from './strategies/jwt-admin.strategy';
import { MemberTokenGuard } from './guards/member-token.guard';
import { JwtAdminGuard } from './guards/jwt-admin.guard';
import { OrGuard } from './guards/or.guard';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
    MailModule,
  ],
  providers: [
    AuthService,
    LocalAdminStrategy,
    JwtAdminStrategy,
    MemberTokenGuard,
    JwtAdminGuard,
    OrGuard,
  ],
  controllers: [AuthController],
  exports: [AuthService, MemberTokenGuard, JwtModule, JwtAdminGuard, OrGuard],
})
export class AuthModule {}
