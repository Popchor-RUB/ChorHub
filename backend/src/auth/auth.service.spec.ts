import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '../generated/prisma/client';
import * as bcrypt from 'bcrypt';

type MockPrisma = DeepMockProxy<PrismaClient>;

const mockMember = {
  id: 'member-1',
  firstName: 'Anna',
  lastName: 'Müller',
  email: 'anna@choir.de',
  choirVoice: 'SOPRAN' as const,
  loginToken: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AuthService', () => {
  let service: AuthService;
  let prismaMock: MockPrisma;
  let mailService: jest.Mocked<MailService>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaClient>();
    mailService = {
      sendMagicLink: jest.fn().mockResolvedValue(undefined),
      sendMemberInvite: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<MailService>;
    jwtService = {
      sign: jest.fn().mockReturnValue('signed-jwt-token'),
    } as unknown as jest.Mocked<JwtService>;

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtService },
        { provide: MailService, useValue: mailService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((_k: string, def?: string) => def ?? 'http://localhost:5173'),
            getOrThrow: jest.fn(() => 'http://localhost:5173'),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('validateAdminPassword', () => {
    it('returns null when admin not found', async () => {
      prismaMock.adminUser.findUnique.mockResolvedValue(null);
      const result = await service.validateAdminPassword('admin', 'pass');
      expect(result).toBeNull();
    });

    it('returns null when password does not match', async () => {
      prismaMock.adminUser.findUnique.mockResolvedValue({
        id: 'a1',
        username: 'admin',
        passwordHash: await bcrypt.hash('correct', 10),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const result = await service.validateAdminPassword('admin', 'wrong');
      expect(result).toBeNull();
    });

    it('returns admin when credentials are valid', async () => {
      const hash = await bcrypt.hash('correctpass', 10);
      const admin = {
        id: 'a1',
        username: 'admin',
        passwordHash: hash,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prismaMock.adminUser.findUnique.mockResolvedValue(admin);
      const result = await service.validateAdminPassword('admin', 'correctpass');
      expect(result).toEqual(admin);
    });
  });

  describe('signAdminJwt', () => {
    it('calls jwtService.sign with correct payload', () => {
      service.signAdminJwt({ id: 'a1', username: 'admin' });
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'a1', username: 'admin', role: 'admin' }),
      );
    });
  });

  describe('requestMagicLink', () => {
    it('silently does nothing when member not found', async () => {
      prismaMock.member.findUnique.mockResolvedValue(null);
      await service.requestMagicLink('unknown@example.com');
      expect(mailService.sendMagicLink).not.toHaveBeenCalled();
      expect(prismaMock.member.update).not.toHaveBeenCalled();
    });

    it('generates token, updates member, and sends email when member exists', async () => {
      prismaMock.member.findUnique.mockResolvedValue(mockMember);
      prismaMock.member.update.mockResolvedValue(mockMember);

      await service.requestMagicLink('anna@choir.de');

      expect(prismaMock.member.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'anna@choir.de' },
          data: expect.objectContaining({ loginToken: expect.any(String) }),
        }),
      );
      expect(mailService.sendMagicLink).toHaveBeenCalledTimes(1);
      expect(mailService.sendMagicLink).toHaveBeenCalledWith(
        mockMember,
        expect.stringContaining('/auth/verify?token='),
        expect.any(String),
      );
    });

    it('stores hashed token (not raw) in the database', async () => {
      prismaMock.member.findUnique.mockResolvedValue(mockMember);
      prismaMock.member.update.mockResolvedValue(mockMember);

      await service.requestMagicLink('anna@choir.de');

      const updateCall = prismaMock.member.update.mock.calls[0][0];
      const storedToken = (updateCall.data as Record<string, unknown>).loginToken as string;

      const mailCall = mailService.sendMagicLink.mock.calls[0];
      const magicUrl = mailCall[1];
      const rawToken = new URL(magicUrl).searchParams.get('token')!;

      // The stored token must NOT equal the raw token
      expect(storedToken).not.toBe(rawToken);
      expect(storedToken).toHaveLength(64); // SHA-256 hex = 64 chars
    });
  });

  describe('verifyMagicLink', () => {
    it('throws UnauthorizedException for invalid token', async () => {
      prismaMock.member.findUnique.mockResolvedValue(null);
      await expect(service.verifyMagicLink('bad-token')).rejects.toThrow(UnauthorizedException);
    });

    it('returns member data for valid token without clearing it', async () => {
      prismaMock.member.findUnique.mockResolvedValue(mockMember);

      const result = await service.verifyMagicLink('valid-raw-token');

      expect(result.member.id).toBe(mockMember.id);
      expect(result.token).toBe('valid-raw-token');
      // Token must NOT be cleared (permanent)
      expect(prismaMock.member.update).not.toHaveBeenCalled();
    });
  });
});
