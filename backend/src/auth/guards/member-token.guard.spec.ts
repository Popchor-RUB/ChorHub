import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MemberTokenGuard } from './member-token.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '../../generated/prisma/client';

const buildContext = (headers: Record<string, string>): ExecutionContext => {
  const request = { headers, user: undefined as any };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
};

const mockMember = {
  id: 'member-1',
  firstName: 'Anna',
  lastName: 'Müller',
  email: 'anna@choir.de',
  choirVoice: 'SOPRAN' as const,
  lastLoginAt: null as Date | null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockTokenRecord = {
  id: 'token-1',
  memberId: 'member-1',
  hashedToken: 'hashed-token',
  createdAt: new Date(),
  member: mockMember,
};

describe('MemberTokenGuard', () => {
  let guard: MemberTokenGuard;
  let prismaMock: DeepMockProxy<PrismaClient>;

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaClient>();
    const module = await Test.createTestingModule({
      providers: [
        MemberTokenGuard,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    guard = module.get(MemberTokenGuard);
  });

  it('throws UnauthorizedException when no token provided', async () => {
    const ctx = buildContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for invalid token', async () => {
    prismaMock.memberLoginToken.findUnique.mockResolvedValue(null);
    const ctx = buildContext({ 'x-member-token': 'invalid-token' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('sets request.user and returns true for valid token', async () => {
    prismaMock.memberLoginToken.findUnique.mockResolvedValue(mockTokenRecord as any);
    prismaMock.member.updateMany.mockResolvedValue({ count: 1 });
    const request = { headers: { 'x-member-token': 'valid-raw-token' }, user: undefined as any };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(request.user.id).toBe(mockMember.id);
    expect(request.user.role).toBe('member');
    expect(prismaMock.member.updateMany).toHaveBeenCalledTimes(1);
  });

  it('accepts token from Authorization Bearer header', async () => {
    prismaMock.memberLoginToken.findUnique.mockResolvedValue(mockTokenRecord as any);
    prismaMock.member.updateMany.mockResolvedValue({ count: 1 });
    const request = {
      headers: { authorization: 'Bearer valid-raw-token' },
      user: undefined as any,
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('does not update lastLoginAt when already set today', async () => {
    const now = new Date();
    prismaMock.memberLoginToken.findUnique.mockResolvedValue({
      ...mockTokenRecord,
      member: { ...mockMember, lastLoginAt: now },
    } as any);
    const request = { headers: { 'x-member-token': 'valid-raw-token' }, user: undefined as any };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await guard.canActivate(ctx);

    expect(prismaMock.member.updateMany).not.toHaveBeenCalled();
  });

  it('throttles updates to once per member per day', async () => {
    const oldDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    prismaMock.memberLoginToken.findUnique.mockResolvedValue({
      ...mockTokenRecord,
      member: { ...mockMember, lastLoginAt: oldDate },
    } as any);
    prismaMock.member.updateMany.mockResolvedValue({ count: 1 });

    const request1 = { headers: { 'x-member-token': 'valid-raw-token' }, user: undefined as any };
    const ctx1 = {
      switchToHttp: () => ({ getRequest: () => request1 }),
    } as unknown as ExecutionContext;
    await guard.canActivate(ctx1);

    const request2 = { headers: { 'x-member-token': 'valid-raw-token' }, user: undefined as any };
    const ctx2 = {
      switchToHttp: () => ({ getRequest: () => request2 }),
    } as unknown as ExecutionContext;
    await guard.canActivate(ctx2);

    expect(prismaMock.member.updateMany).toHaveBeenCalledTimes(1);
  });
});
