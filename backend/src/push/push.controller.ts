import { Body, Controller, Delete, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { PushService } from './push.service';
import { SubscribeDto } from './dto/subscribe.dto';
import { MemberTokenGuard } from '../auth/guards/member-token.guard';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';
import { OrGuard } from '../auth/guards/or.guard';
import { IsOptional, IsString } from 'class-validator';
import type { Request } from 'express';

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
  async subscribe(@Req() req: Request, @Body() dto: SubscribeDto) {
    const user = req.user as { id: string };
    await this.pushService.subscribe(user.id, dto);
  }

  @Delete('unsubscribe')
  @HttpCode(204)
  @UseGuards(MemberTokenGuard)
  async unsubscribe(@Req() req: Request, @Body() dto: UnsubscribeDto) {
    const user = req.user as { id: string };
    await this.pushService.unsubscribe(user.id, dto.endpoint);
  }
}
