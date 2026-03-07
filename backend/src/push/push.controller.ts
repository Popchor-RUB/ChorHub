import { Body, Controller, Delete, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { PushService } from './push.service';
import { SubscribeDto } from './dto/subscribe.dto';
import { MemberTokenGuard } from '../auth/guards/member-token.guard';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';
import { OrGuard } from '../auth/guards/or.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { IsOptional, IsString } from 'class-validator';
import type { MemberUser } from '../auth/types/auth-user.types';

class UnsubscribeDto {
  @IsString()
  endpoint: string;
}

class SendPushDto {
  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsString()
  @IsOptional()
  url?: string;
}

@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Get('vapid-public-key')
  @UseGuards(OrGuard)
  getVapidPublicKey() {
    return { publicKey: this.pushService.getVapidPublicKey() };
  }

  @Get('admin/stats')
  @UseGuards(JwtAdminGuard)
  async getStats() {
    const subscriberCount = await this.pushService.getSubscriberCount();
    return { subscriberCount };
  }

  @Post('admin/send')
  @HttpCode(204)
  @UseGuards(JwtAdminGuard)
  async sendToAll(@Body() dto: SendPushDto) {
    await this.pushService.sendToAll({ title: dto.title, body: dto.body, url: dto.url });
  }

  @Post('subscribe')
  @HttpCode(204)
  @UseGuards(MemberTokenGuard)
  async subscribe(@CurrentUser() user: MemberUser, @Body() dto: SubscribeDto) {
    await this.pushService.subscribe(user.id, dto);
  }

  @Delete('unsubscribe')
  @HttpCode(204)
  @UseGuards(MemberTokenGuard)
  async unsubscribe(@CurrentUser() user: MemberUser, @Body() dto: UnsubscribeDto) {
    await this.pushService.unsubscribe(user.id, dto.endpoint);
  }
}
