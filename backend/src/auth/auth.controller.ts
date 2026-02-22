import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { MagicLinkRequestDto } from './dto/magic-link-request.dto';
import { PasskeyChallengeDto, PasskeyVerifyDto, PasskeyRegisterVerifyDto } from './dto/passkey.dto';
import { LocalAdminGuard } from './guards/local-admin.guard';
import { JwtAdminGuard } from './guards/jwt-admin.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(LocalAdminGuard)
  @Post('admin/login')
  async adminLogin(@CurrentUser() user: any) {
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
  async passkeyVerify(
    @Body() body: { adminId: string; assertion: Record<string, unknown> },
  ) {
    const token = await this.authService.verifyPasskeyAuth(
      body.adminId,
      body.assertion as any,
    );
    return { token };
  }

  @UseGuards(JwtAdminGuard)
  @Post('admin/passkey/register/challenge')
  async passkeyRegisterChallenge(@CurrentUser() user: any) {
    return this.authService.getPasskeyRegisterChallenge(user.id);
  }

  @UseGuards(JwtAdminGuard)
  @Post('admin/passkey/register/verify')
  async passkeyRegisterVerify(
    @CurrentUser() user: any,
    @Body() dto: PasskeyRegisterVerifyDto,
  ) {
    return this.authService.verifyPasskeyRegister(user.id, dto.attestation as any);
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
}
