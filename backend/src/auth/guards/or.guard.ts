import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { JwtAdminGuard } from './jwt-admin.guard';
import { MemberTokenGuard } from './member-token.guard';

/**
 * A guard that allows access if EITHER the JwtAdminGuard OR MemberTokenGuard passes.
 * This is useful for endpoints that should be accessible by both admins and members.
 */
@Injectable()
export class OrGuard implements CanActivate {
  private readonly logger = new Logger(OrGuard.name);

  constructor(
    private readonly jwtAdminGuard: JwtAdminGuard,
    private readonly memberTokenGuard: MemberTokenGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Try JwtAdminGuard first
    try {
      const isAdmin = await this.jwtAdminGuard.canActivate(context);
      if (isAdmin) {
        return true;
      }
    } catch {
      this.logger.debug('JwtAdminGuard failed, trying MemberTokenGuard');
    }

    // If admin guard failed, try MemberTokenGuard
    try {
      const isMember = await this.memberTokenGuard.canActivate(context);
      if (isMember) {
        return true;
      }
    } catch {
      this.logger.debug('MemberTokenGuard also failed');
    }

    // Both guards failed
    return false;
  }
}
