import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { MagicLinkRequestDto } from './dto/magic-link-request.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { PasskeyChallengeDto, PasskeyVerifyDto, PasskeyRegisterVerifyDto } from './dto/passkey.dto';
import { LocalAdminGuard } from './guards/local-admin.guard';
import { JwtAdminGuard } from './guards/jwt-admin.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import type { AdminUser } from './types/auth-user.types';

// All auth endpoints are rate-limited to 10 requests per 15 minutes per IP.
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 50, ttl: process.env.NODE_ENV === 'production' ? 900_000 : 0 } })
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(LocalAdminGuard)
  @Post('admin/login')
  adminLogin(@CurrentUser() user: AdminUser) {
    const token = this.authService.signAdminJwt(user);
    return { token };
  }

  @Public()
  @Post('admin/passkey/challenge')
  async passkeyChallenge(@Body() dto: PasskeyChallengeDto) {
    return this.authService.getPasskeyAuthChallenge(dto.username);
  }

  @Public()
  @Post('admin/passkey/verify')
  async passkeyVerify(@Body() dto: PasskeyVerifyDto) {
    const token = await this.authService.verifyPasskeyAuth(dto.sessionId, dto.assertion);
    return { token };
  }

  @UseGuards(JwtAdminGuard)
  @Post('admin/passkey/register/challenge')
  async passkeyRegisterChallenge(@CurrentUser() user: AdminUser) {
    return this.authService.getPasskeyRegisterChallenge(user.id);
  }

  @UseGuards(JwtAdminGuard)
  @Post('admin/passkey/register/verify')
  async passkeyRegisterVerify(
    @CurrentUser() user: AdminUser,
    @Body() dto: PasskeyRegisterVerifyDto,
  ) {
    return this.authService.verifyPasskeyRegister(user.id, dto.attestation);
  }

  @Public()
  @Post('magic-link/request')
  async requestMagicLink(@Body() dto: MagicLinkRequestDto) {
    await this.authService.requestMagicLink(dto.email);
    return { message: 'Falls die E-Mail-Adresse bekannt ist, wurde ein Link versendet.' };
  }

  @Public()
  @Get('magic-link/verify')
  async verifyMagicLink(@Query('token') token: string) {
    return this.authService.verifyMagicLink(token);
  }

  @Public()
  @Post('magic-link/verify-code')
  async verifyCode(@Body() dto: VerifyCodeDto) {
    return this.authService.verifyCode(dto.email, dto.code);
  }
}
