import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { MemberUser } from '../types/auth-user.types';

interface AuthenticatableRequest {
  headers: Record<string, string | undefined>;
  user: MemberUser;
}

@Injectable()
export class MemberTokenGuard implements CanActivate {
  private readonly logger = new Logger(MemberTokenGuard.name);
  private readonly lastLoginUpdateAttemptDayByMember = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatableRequest>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Kein Zugriffstoken vorhanden');
    }

    const hashedToken = createHash('sha256').update(token).digest('hex');
    const tokenRecord = await this.prisma.memberLoginToken.findUnique({
      where: { hashedToken },
      include: { member: true },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Ungültiger Zugriffstoken');
    }

    await this.updateLastLoginAtIfNeeded(tokenRecord.member.id, tokenRecord.member.lastLoginAt);
    request.user = { id: tokenRecord.member.id, role: 'member' as const, member: tokenRecord.member };
    return true;
  }

  private extractToken(request: AuthenticatableRequest): string | null {
    const authHeader = request.headers['authorization'] ?? '';
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return request.headers['x-member-token'] ?? null;
  }

  private async updateLastLoginAtIfNeeded(memberId: string, lastLoginAt: Date | null): Promise<void> {
    const todayKey = this.getUtcDayKey(new Date());

    // Throttle writes to at most one DB update attempt per member and day.
    if (this.lastLoginUpdateAttemptDayByMember.get(memberId) === todayKey) {
      return;
    }

    if (lastLoginAt && this.getUtcDayKey(lastLoginAt) === todayKey) {
      return;
    }

    this.lastLoginUpdateAttemptDayByMember.set(memberId, todayKey);

    const startOfTodayUtc = new Date(`${todayKey}T00:00:00.000Z`);
    try {
      await this.prisma.member.updateMany({
        where: {
          id: memberId,
          OR: [{ lastLoginAt: null }, { lastLoginAt: { lt: startOfTodayUtc } }],
        },
        data: { lastLoginAt: new Date() },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to update lastLoginAt for member ${memberId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private getUtcDayKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
