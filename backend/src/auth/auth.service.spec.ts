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
  choirVoiceId: null,
  loginCode: null,
  loginCodeExpiresAt: null,
  lastLoginAt: null,
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
    // Allow $transaction to actually execute the provided operations
    prismaMock.$transaction.mockImplementation((ops: any) => Promise.all(ops));

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
      expect(prismaMock.memberLoginToken.create).not.toHaveBeenCalled();
    });

    it('creates a login token, updates member with code, and sends email when member exists', async () => {
      prismaMock.member.findUnique.mockResolvedValue(mockMember);
      prismaMock.memberLoginToken.create.mockResolvedValue({} as any);
      prismaMock.member.update.mockResolvedValue(mockMember);

      await service.requestMagicLink('anna@choir.de');

      expect(prismaMock.memberLoginToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            memberId: mockMember.id,
            hashedToken: expect.any(String),
          }),
        }),
      );
      expect(prismaMock.member.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'anna@choir.de' },
          data: expect.objectContaining({
            loginCode: expect.any(String),
            loginCodeExpiresAt: expect.any(Date),
          }),
        }),
      );
      expect(mailService.sendMagicLink).toHaveBeenCalledTimes(1);
      expect(mailService.sendMagicLink).toHaveBeenCalledWith(
        mockMember,
        expect.stringContaining('/auth/verify?token='),
        expect.any(String),
        expect.stringMatching(/^\d{6}$/),
      );
    });

    it('stores hashed token (not raw) in MemberLoginToken', async () => {
      prismaMock.member.findUnique.mockResolvedValue(mockMember);
      prismaMock.memberLoginToken.create.mockResolvedValue({} as any);
      prismaMock.member.update.mockResolvedValue(mockMember);

      await service.requestMagicLink('anna@choir.de');

      const createCall = prismaMock.memberLoginToken.create.mock.calls[0][0];
      const storedHash = (createCall.data as Record<string, unknown>).hashedToken as string;

      const mailCall = mailService.sendMagicLink.mock.calls[0];
      const magicUrl = mailCall[1];
      const rawToken = new URL(magicUrl).searchParams.get('token')!;
      const rawCode = mailCall[3];

      // Stored token must be the hash, not the raw value
      expect(storedHash).not.toBe(rawToken);
      expect(storedHash).toHaveLength(64); // SHA-256 hex = 64 chars

      // The code stored in member update must also be hashed
      const updateCall = prismaMock.member.update.mock.calls[0][0];
      const storedCode = (updateCall.data as Record<string, unknown>).loginCode as string;
      expect(storedCode).not.toBe(rawCode);
      expect(storedCode).toHaveLength(64);
    });

    it('sets loginCodeExpiresAt ~15 minutes from now', async () => {
      prismaMock.member.findUnique.mockResolvedValue(mockMember);
      prismaMock.memberLoginToken.create.mockResolvedValue({} as any);
      prismaMock.member.update.mockResolvedValue(mockMember);

      const before = Date.now();
      await service.requestMagicLink('anna@choir.de');
      const after = Date.now();

      const updateCall = prismaMock.member.update.mock.calls[0][0];
      const expiresAt = ((updateCall.data as Record<string, unknown>).loginCodeExpiresAt as Date).getTime();

      expect(expiresAt).toBeGreaterThanOrEqual(before + 14 * 60 * 1000);
      expect(expiresAt).toBeLessThanOrEqual(after + 16 * 60 * 1000);
    });
  });

  describe('verifyCode', () => {
    const { createHash } = jest.requireActual<typeof import('crypto')>('crypto');

    const rawCode = '123456';
    const hashedCode = createHash('sha256').update(rawCode).digest('hex');
    const mockMemberWithCode = {
      ...mockMember,
      loginCode: hashedCode,
      loginCodeExpiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min in future
    };

    it('throws UnauthorizedException when member not found', async () => {
      prismaMock.member.findUnique.mockResolvedValue(null);
      await expect(service.verifyCode('nobody@example.com', rawCode)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong code', async () => {
      prismaMock.member.findUnique.mockResolvedValue(mockMemberWithCode);
      await expect(service.verifyCode('anna@choir.de', '000000')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for expired code', async () => {
      const expired = {
        ...mockMemberWithCode,
        loginCodeExpiresAt: new Date(Date.now() - 1000), // 1 second ago
      };
      prismaMock.member.findUnique.mockResolvedValue(expired);
      await expect(service.verifyCode('anna@choir.de', rawCode)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when loginCode is null', async () => {
      prismaMock.member.findUnique.mockResolvedValue(mockMember); // loginCode: null
      await expect(service.verifyCode('anna@choir.de', rawCode)).rejects.toThrow(UnauthorizedException);
    });

    it('returns new token and member data for valid code', async () => {
      prismaMock.member.findUnique.mockResolvedValue(mockMemberWithCode);
      prismaMock.memberLoginToken.create.mockResolvedValue({} as any);
      prismaMock.member.update.mockResolvedValue(mockMember);

      const result = await service.verifyCode('anna@choir.de', rawCode);

      expect(result.token).toBeDefined();
      expect(result.token).toHaveLength(64); // raw hex token
      expect(result.member.id).toBe(mockMember.id);
      expect(result.member.email).toBe(mockMember.email);
    });

    it('clears loginCode and loginCodeExpiresAt after successful verification', async () => {
      prismaMock.member.findUnique.mockResolvedValue(mockMemberWithCode);
      prismaMock.memberLoginToken.create.mockResolvedValue({} as any);
      prismaMock.member.update.mockResolvedValue(mockMember);

      await service.verifyCode('anna@choir.de', rawCode);

      expect(prismaMock.member.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            loginCode: null,
            loginCodeExpiresAt: null,
          }),
        }),
      );
    });

    it('creates a new MemberLoginToken with hashed token after successful verification', async () => {
      prismaMock.member.findUnique.mockResolvedValue(mockMemberWithCode);
      prismaMock.memberLoginToken.create.mockResolvedValue({} as any);
      prismaMock.member.update.mockResolvedValue(mockMember);

      const result = await service.verifyCode('anna@choir.de', rawCode);

      const createCall = prismaMock.memberLoginToken.create.mock.calls[0][0];
      const storedHash = (createCall.data as Record<string, unknown>).hashedToken as string;

      // Stored token must be the hash of the returned raw token
      const expectedHash = createHash('sha256').update(result.token).digest('hex');
      expect(storedHash).toBe(expectedHash);
    });
  });

  describe('verifyMagicLink', () => {
    it('throws UnauthorizedException for invalid token', async () => {
      prismaMock.memberLoginToken.findUnique.mockResolvedValue(null);
      await expect(service.verifyMagicLink('bad-token')).rejects.toThrow(UnauthorizedException);
    });

    it('returns member data for valid token and updates lastLoginAt', async () => {
      prismaMock.memberLoginToken.findUnique.mockResolvedValue({
        id: 'token-1',
        memberId: mockMember.id,
        hashedToken: 'some-hash',
        createdAt: new Date(),
        member: mockMember,
      } as any);
      prismaMock.member.update.mockResolvedValue({ ...mockMember, lastLoginAt: new Date() });

      const result = await service.verifyMagicLink('valid-raw-token');

      expect(result.member.id).toBe(mockMember.id);
      expect(result.token).toBe('valid-raw-token');
      expect(prismaMock.member.update).toHaveBeenCalledWith({
        where: { id: mockMember.id },
        data: { lastLoginAt: expect.any(Date) },
      });
      // Token must NOT be cleared or modified (permanent)
      expect(prismaMock.memberLoginToken.delete).not.toHaveBeenCalled();
    });
  });
});
