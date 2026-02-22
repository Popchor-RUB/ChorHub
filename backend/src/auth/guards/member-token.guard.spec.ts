import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MemberTokenGuard } from './member-token.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { mockDeep } from 'jest-mock-extended';

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
  loginToken: 'hashed-token',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('MemberTokenGuard', () => {
  let guard: MemberTokenGuard;
  let prismaMock: ReturnType<typeof mockDeep<any>>;

  beforeEach(async () => {
    prismaMock = mockDeep();
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
    prismaMock.member.findUnique.mockResolvedValue(null);
    const ctx = buildContext({ 'x-member-token': 'invalid-token' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('sets request.user and returns true for valid token', async () => {
    prismaMock.member.findUnique.mockResolvedValue(mockMember);
    const request = { headers: { 'x-member-token': 'valid-raw-token' }, user: undefined as any };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(request.user.id).toBe(mockMember.id);
    expect(request.user.role).toBe('member');
  });

  it('accepts token from Authorization Bearer header', async () => {
    prismaMock.member.findUnique.mockResolvedValue(mockMember);
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
});
