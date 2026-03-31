import {
  Body,
  Controller,
  Get,
  Ip,
  Logger,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { MagicLinkRequestDto } from './dto/magic-link-request.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { CurrentUser } from './decorators/current-user.decorator';
import { LocalAdminGuard } from './guards/local-admin.guard';
import { Public } from './decorators/public.decorator';
import type { AdminUser } from './types/auth-user.types';

// All auth endpoints are rate-limited to 10 requests per 15 minutes per IP.
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 50, ttl: process.env.NODE_ENV === 'production' ? 900_000 : 0 } })
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(LocalAdminGuard)
  @Post('admin/login')
  async adminLogin(
    @CurrentUser() user: AdminUser,
    @Ip() ipAddress: string,
  ) {
    const token = this.authService.signAdminJwt(user);
    await this.authService.recordAdminAuthenticationSuccess(user, ipAddress);
    this.logger.log(`Admin authenticated successfully (username=${user.username}, ip=${ipAddress})`);
    return { token };
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
