import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import type { SubscribeDto } from './dto/subscribe.dto';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const publicKey = this.config.getOrThrow<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.getOrThrow<string>('VAPID_PRIVATE_KEY');
    const email = this.config.getOrThrow<string>('VAPID_EMAIL');
    webpush.setVapidDetails(email, publicKey, privateKey);
  }

  getVapidPublicKey(): string {
    return this.config.getOrThrow<string>('VAPID_PUBLIC_KEY');
  }

  async subscribe(memberId: string, dto: SubscribeDto): Promise<void> {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      update: { p256dh: dto.p256dh, auth: dto.auth },
      create: { memberId, endpoint: dto.endpoint, p256dh: dto.p256dh, auth: dto.auth },
    });
  }

  async unsubscribe(memberId: string, endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({
      where: { memberId, endpoint },
    });
  }

  async sendToMember(memberId: string, payload: PushPayload): Promise<void> {
    const subs = await this.prisma.pushSubscription.findMany({
      where: { memberId },
    });
    await Promise.allSettled(
      subs.map((sub) => this.sendRaw(sub, payload)),
    );
  }

  async sendToAll(payload: PushPayload): Promise<void> {
    const subs = await this.prisma.pushSubscription.findMany();
    await Promise.allSettled(
      subs.map((sub) => this.sendRaw(sub, payload)),
    );
  }

  private async sendRaw(
    sub: { id: string; endpoint: string; p256dh: string; auth: string },
    payload: PushPayload,
  ): Promise<void> {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      );
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 410 || status === 404) {
        await this.prisma.pushSubscription.delete({ where: { id: sub.id } });
        this.logger.log(`Removed stale subscription ${sub.id}`);
      } else {
        this.logger.warn(`Push failed for ${sub.id}: ${String(err)}`);
      }
    }
  }
}
