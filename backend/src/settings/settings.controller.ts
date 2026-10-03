import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth-user.types';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';
import { OrGuard } from '../auth/guards/or.guard';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { SettingsKeyPipe } from './settings-key.pipe';
import { SettingsService } from './settings.service';

const MEMBER_READABLE_SETTING_KEYS = new Set(['cloud.url']);

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @UseGuards(JwtAdminGuard)
  list() {
    return this.settingsService.list();
  }

  @Get(':key')
  @UseGuards(OrGuard)
  get(
    @Param('key', SettingsKeyPipe) key: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.role === 'member' && !MEMBER_READABLE_SETTING_KEYS.has(key)) {
      throw new ForbiddenException();
    }
    return this.settingsService.get(key);
  }

  @Put(':key')
  @UseGuards(JwtAdminGuard)
  set(
    @Param('key', SettingsKeyPipe) key: string,
    @Body() dto: UpdateSettingDto,
  ) {
    return this.settingsService.set(key, dto.value);
  }

  @Delete(':key')
  @UseGuards(JwtAdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('key', SettingsKeyPipe) key: string): Promise<void> {
    await this.settingsService.delete(key);
  }
}
