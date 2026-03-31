import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

interface JwtPayload {
  sub: string;
  username: string;
  role: 'admin';
}

@Injectable()
export class JwtAdminStrategy extends PassportStrategy(Strategy, 'jwt-admin') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const jwtSecret = config.get<string>('JWT_SECRET');
    if (
      !jwtSecret ||
      jwtSecret.trim() === '' ||
      jwtSecret === 'change_me_to_a_long_random_secret'
    ) {
      throw new Error(
        'JWT_SECRET must be set to a non-default secure value. Refusing to start.',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.role !== 'admin') {
      throw new UnauthorizedException();
    }
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: payload.sub },
    });
    if (!admin) {
      throw new UnauthorizedException();
    }
    return { id: admin.id, username: admin.username, role: 'admin' as const };
  }
}
