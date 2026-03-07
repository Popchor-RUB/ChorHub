import {
  CanActivate,
  ExecutionContext,
  Injectable,
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
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatableRequest>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Kein Zugriffstoken vorhanden');
    }

    const hashedToken = createHash('sha256').update(token).digest('hex');
    const member = await this.prisma.member.findUnique({
      where: { loginToken: hashedToken },
    });

    if (!member) {
      throw new UnauthorizedException('Ungültiger Zugriffstoken');
    }

    request.user = { id: member.id, role: 'member' as const, member };
    return true;
  }

  private extractToken(request: AuthenticatableRequest): string | null {
    const authHeader = request.headers['authorization'] ?? '';
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return request.headers['x-member-token'] ?? null;
  }
}
