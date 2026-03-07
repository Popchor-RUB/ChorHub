import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { GlobalAuthGuard } from './global-auth.guard';
import { JwtAdminGuard } from './jwt-admin.guard';
import { MemberTokenGuard } from './member-token.guard';

const buildContext = (): ExecutionContext =>
  ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
  }) as unknown as ExecutionContext;

describe('GlobalAuthGuard', () => {
  let guard: GlobalAuthGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let jwtAdminGuard: { canActivate: jest.Mock };
  let memberTokenGuard: { canActivate: jest.Mock };

  beforeEach(async () => {
    reflector = { getAllAndOverride: jest.fn() };
    jwtAdminGuard = { canActivate: jest.fn() };
    memberTokenGuard = { canActivate: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        GlobalAuthGuard,
        { provide: Reflector, useValue: reflector },
        { provide: JwtAdminGuard, useValue: jwtAdminGuard },
        { provide: MemberTokenGuard, useValue: memberTokenGuard },
      ],
    }).compile();

    guard = module.get(GlobalAuthGuard);
  });

  it('allows @Public() routes without any authentication', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
    expect(jwtAdminGuard.canActivate).not.toHaveBeenCalled();
    expect(memberTokenGuard.canActivate).not.toHaveBeenCalled();
  });

  it('allows valid admin JWT and skips member token check', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    jwtAdminGuard.canActivate.mockResolvedValue(true);
    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
    expect(memberTokenGuard.canActivate).not.toHaveBeenCalled();
  });

  it('falls through to member token when JWT guard throws', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    jwtAdminGuard.canActivate.mockRejectedValue(new UnauthorizedException());
    memberTokenGuard.canActivate.mockResolvedValue(true);
    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
  });

  it('throws UnauthorizedException when both guards fail', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    jwtAdminGuard.canActivate.mockRejectedValue(new UnauthorizedException());
    memberTokenGuard.canActivate.mockRejectedValue(new UnauthorizedException());
    await expect(guard.canActivate(buildContext())).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for completely unauthenticated request', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    jwtAdminGuard.canActivate.mockRejectedValue(new Error('no token'));
    memberTokenGuard.canActivate.mockRejectedValue(new Error('no token'));
    await expect(guard.canActivate(buildContext())).rejects.toThrow(UnauthorizedException);
  });
});
