import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PassportModule } from '@nestjs/passport';
import { JwtAdminStrategy } from './jwt-admin.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '../../generated/prisma/client';

const mockAdmin = {
  id: 'admin-1',
  username: 'admin',
  passwordHash: 'hash',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('JwtAdminStrategy', () => {
  let strategy: JwtAdminStrategy;
  let prismaMock: DeepMockProxy<PrismaClient>;

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaClient>();

    const module = await Test.createTestingModule({
      imports: [PassportModule],
      providers: [
        JwtAdminStrategy,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
      ],
    }).compile();

    strategy = module.get(JwtAdminStrategy);
  });

  it('returns AdminUser for a valid admin JWT payload', async () => {
    prismaMock.adminUser.findUnique.mockResolvedValue(mockAdmin);
    const result = await strategy.validate({
      sub: 'admin-1',
      username: 'admin',
      role: 'admin',
    });
    expect(result).toEqual({ id: 'admin-1', username: 'admin', role: 'admin' });
  });

  it('throws UnauthorizedException when role is not admin', async () => {
    // Covers tampered JWTs or any non-admin role claim — a member token cannot
    // produce a valid admin JWT, but if someone crafted one with role != 'admin'
    // it must be rejected before hitting the DB.
    await expect(
      strategy.validate({ sub: 'member-1', username: 'member', role: 'member' as any }),
    ).rejects.toThrow(UnauthorizedException);
    expect(prismaMock.adminUser.findUnique).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when admin ID does not exist in DB', async () => {
    // Covers deleted or revoked admin accounts
    prismaMock.adminUser.findUnique.mockResolvedValue(null);
    await expect(
      strategy.validate({ sub: 'deleted-admin', username: 'admin', role: 'admin' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for a missing role claim', async () => {
    await expect(
      strategy.validate({ sub: 'admin-1', username: 'admin', role: undefined as any }),
    ).rejects.toThrow(UnauthorizedException);
    expect(prismaMock.adminUser.findUnique).not.toHaveBeenCalled();
  });
});
