import { ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OrGuard } from './or.guard';
import { JwtAdminGuard } from './jwt-admin.guard';
import { MemberTokenGuard } from './member-token.guard';

const buildContext = (): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
  }) as unknown as ExecutionContext;

describe('OrGuard', () => {
  let guard: OrGuard;
  let jwtAdminGuard: { canActivate: jest.Mock };
  let memberTokenGuard: { canActivate: jest.Mock };

  beforeEach(async () => {
    jwtAdminGuard = { canActivate: jest.fn() };
    memberTokenGuard = { canActivate: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        OrGuard,
        { provide: JwtAdminGuard, useValue: jwtAdminGuard },
        { provide: MemberTokenGuard, useValue: memberTokenGuard },
      ],
    }).compile();

    guard = module.get(OrGuard);
  });

  it('returns true when admin JWT is valid', async () => {
    jwtAdminGuard.canActivate.mockResolvedValue(true);
    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
    expect(memberTokenGuard.canActivate).not.toHaveBeenCalled();
  });

  it('returns true when member token is valid and admin JWT fails', async () => {
    jwtAdminGuard.canActivate.mockRejectedValue(new Error('invalid jwt'));
    memberTokenGuard.canActivate.mockResolvedValue(true);
    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
  });

  it('returns false when both guards fail (unauthenticated)', async () => {
    jwtAdminGuard.canActivate.mockRejectedValue(new Error('no jwt'));
    memberTokenGuard.canActivate.mockRejectedValue(new Error('no token'));
    await expect(guard.canActivate(buildContext())).resolves.toBe(false);
  });

  it('returns false when both guards return false', async () => {
    jwtAdminGuard.canActivate.mockResolvedValue(false);
    memberTokenGuard.canActivate.mockResolvedValue(false);
    await expect(guard.canActivate(buildContext())).resolves.toBe(false);
  });
});
