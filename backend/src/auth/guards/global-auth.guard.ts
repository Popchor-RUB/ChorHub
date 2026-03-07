import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtAdminGuard } from './jwt-admin.guard';
import { MemberTokenGuard } from './member-token.guard';

/**
 * Global default-deny guard.
 *
 * Every route that is not explicitly marked @Public() must be authenticated as
 * either a valid admin (JWT) or a valid member (token). Actual token validation
 * is performed here — a syntactically present but invalid token is rejected.
 *
 * Per-route guards (JwtAdminGuard / MemberTokenGuard / OrGuard) layer on top
 * to enforce role-specific access control.
 */
@Injectable()
export class GlobalAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtAdminGuard: JwtAdminGuard,
    private readonly memberTokenGuard: MemberTokenGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    try {
      if (await this.jwtAdminGuard.canActivate(context)) return true;
    } catch {
      // not a valid admin JWT — try member token next
    }

    try {
      if (await this.memberTokenGuard.canActivate(context)) return true;
    } catch {
      // not a valid member token either
    }

    throw new UnauthorizedException('Authentication required');
  }
}
