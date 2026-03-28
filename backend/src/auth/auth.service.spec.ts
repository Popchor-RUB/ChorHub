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
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AuthService', () => {
  let service: AuthService;
  let prismaMock: MockPrisma;
  let mailService: jest.Mocked<MailService>;
  let jwtService: jest.Mocked<JwtService>;
  let isStagingValue: 'true' | 'false' | undefined = 'false';

  beforeEach(async () => {
    isStagingValue = 'false';
    prismaMock = mockDeep<PrismaClient>();
    // Allow $transaction to execute both array and callback forms.
    prismaMock.$transaction.mockImplementation((arg: any) => {
      if (typeof arg === 'function') {
        return arg(prismaMock);
      }
      return Promise.all(arg);
    });

    mailService = {
      sendMagicLink: jest.fn().mockResolvedValue(undefined),
      sendMemberInvite: jest.fn().mockResolvedValue(undefined),
      sendPushFallbackReminderMail: jest.fn().mockResolvedValue(undefined),
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
            get: jest.fn((key: string, def?: string) => {
              if (key === 'IS_STAGING') {
                return isStagingValue ?? def;
              }
              return def ?? 'http://localhost:5173';
            }),
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
    it('throws UnauthorizedException when member not found', async () => {
      prismaMock.member.findFirst.mockResolvedValue(null);
      await expect(service.requestMagicLink('unknown@example.com')).rejects.toThrow(UnauthorizedException);
      expect(mailService.sendMagicLink).not.toHaveBeenCalled();
      expect(prismaMock.memberLoginToken.create).not.toHaveBeenCalled();
      expect(prismaMock.memberLoginCode.create).not.toHaveBeenCalled();
    });

    it('creates login token + login code and sends email when member exists', async () => {
      prismaMock.member.findFirst.mockResolvedValue(mockMember);
      prismaMock.memberLoginToken.create.mockResolvedValue({} as any);
      prismaMock.memberLoginCode.create.mockResolvedValue({} as any);
      prismaMock.memberLoginCode.deleteMany.mockResolvedValue({ count: 0 });

      await service.requestMagicLink('anna@choir.de');

      expect(prismaMock.memberLoginToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            memberId: mockMember.id,
            hashedToken: expect.any(String),
          }),
        }),
      );
      expect(prismaMock.memberLoginCode.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            memberId: mockMember.id,
            hashedCode: expect.any(String),
            expiresAt: expect.any(Date),
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

    it('stores hashed token/code (not raw values)', async () => {
      prismaMock.member.findFirst.mockResolvedValue(mockMember);
      prismaMock.memberLoginToken.create.mockResolvedValue({} as any);
      prismaMock.memberLoginCode.create.mockResolvedValue({} as any);
      prismaMock.memberLoginCode.deleteMany.mockResolvedValue({ count: 0 });

      await service.requestMagicLink('anna@choir.de');

      const tokenCreateCall = prismaMock.memberLoginToken.create.mock.calls[0][0];
      const storedTokenHash = (tokenCreateCall.data as Record<string, unknown>).hashedToken as string;

      const codeCreateCall = prismaMock.memberLoginCode.create.mock.calls[0][0];
      const storedCodeHash = (codeCreateCall.data as Record<string, unknown>).hashedCode as string;

      const mailCall = mailService.sendMagicLink.mock.calls[0];
      const magicUrl = mailCall[1];
      const rawToken = new URL(magicUrl).searchParams.get('token')!;
      const rawCode = mailCall[3];

      expect(storedTokenHash).not.toBe(rawToken);
      expect(storedTokenHash).toHaveLength(64);
      expect(storedCodeHash).not.toBe(rawCode);
      expect(storedCodeHash).toHaveLength(64);
    });

    it('sets code expiry to ~15 minutes from now', async () => {
      prismaMock.member.findFirst.mockResolvedValue(mockMember);
      prismaMock.memberLoginToken.create.mockResolvedValue({} as any);
      prismaMock.memberLoginCode.create.mockResolvedValue({} as any);
      prismaMock.memberLoginCode.deleteMany.mockResolvedValue({ count: 0 });

      const before = Date.now();
      await service.requestMagicLink('anna@choir.de');
      const after = Date.now();

      const createCall = prismaMock.memberLoginCode.create.mock.calls[0][0];
      const expiresAt = ((createCall.data as Record<string, unknown>).expiresAt as Date).getTime();

      expect(expiresAt).toBeGreaterThanOrEqual(before + 14 * 60 * 1000);
      expect(expiresAt).toBeLessThanOrEqual(after + 16 * 60 * 1000);
    });

    it('looks up member email case-insensitively', async () => {
      prismaMock.member.findFirst.mockResolvedValue(mockMember);
      prismaMock.memberLoginToken.create.mockResolvedValue({} as any);
      prismaMock.memberLoginCode.create.mockResolvedValue({} as any);
      prismaMock.memberLoginCode.deleteMany.mockResolvedValue({ count: 0 });

      await service.requestMagicLink('ANNA@CHOIR.DE');

      expect(prismaMock.member.findFirst).toHaveBeenCalledWith({
        where: { email: { equals: 'ANNA@CHOIR.DE', mode: 'insensitive' } },
      });
    });
  });

  describe('issueMemberMagicLink', () => {
    it('creates hashed token/code and returns raw artifacts', async () => {
      prismaMock.memberLoginToken.create.mockResolvedValue({} as any);
      prismaMock.memberLoginCode.create.mockResolvedValue({} as any);
      prismaMock.memberLoginCode.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.issueMemberMagicLink(mockMember.id);

      expect(result.magicUrl).toContain('/auth/verify?token=');
      expect(result.rawToken).toHaveLength(64);
      expect(result.loginCode).toMatch(/^\d{6}$/);
      expect(prismaMock.memberLoginToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            memberId: mockMember.id,
            hashedToken: expect.any(String),
          }),
        }),
      );
      expect(prismaMock.memberLoginCode.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            memberId: mockMember.id,
            hashedCode: expect.any(String),
            expiresAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('verifyCode', () => {
    const { createHash } = jest.requireActual<typeof import('crypto')>('crypto');

    const rawCode = '123456';
    const hashedCode = createHash('sha256').update(rawCode).digest('hex');
    const mockCodeRecord = {
      id: 'code-1',
      memberId: mockMember.id,
      hashedCode,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      createdAt: new Date(),
    };

    it('throws UnauthorizedException when code lookup fails', async () => {
      prismaMock.member.findFirst.mockResolvedValue(mockMember);
      prismaMock.memberLoginCode.findFirst.mockResolvedValue(null);
      await expect(service.verifyCode('nobody@example.com', rawCode)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when member is not found', async () => {
      prismaMock.member.findFirst.mockResolvedValue(null);
      await expect(service.verifyCode('nobody@example.com', rawCode)).rejects.toThrow(UnauthorizedException);
      expect(prismaMock.memberLoginCode.findFirst).not.toHaveBeenCalled();
    });

    it('returns new token and member data for valid code', async () => {
      prismaMock.member.findFirst.mockResolvedValue(mockMember);
      prismaMock.memberLoginCode.findFirst.mockResolvedValue(mockCodeRecord as any);
      prismaMock.memberLoginCode.deleteMany.mockResolvedValue({ count: 1 });
      prismaMock.memberLoginToken.create.mockResolvedValue({} as any);
      prismaMock.member.update.mockResolvedValue({ ...mockMember, lastLoginAt: new Date() });

      const result = await service.verifyCode('anna@choir.de', rawCode);

      expect(result.token).toBeDefined();
      expect(result.token).toHaveLength(64);
      expect(result.member.id).toBe(mockMember.id);
      expect(result.member.email).toBe(mockMember.email);
    });

    it('consumes the login code on successful verification', async () => {
      prismaMock.member.findFirst.mockResolvedValue(mockMember);
      prismaMock.memberLoginCode.findFirst.mockResolvedValue(mockCodeRecord as any);
      prismaMock.memberLoginCode.deleteMany.mockResolvedValue({ count: 1 });
      prismaMock.memberLoginToken.create.mockResolvedValue({} as any);
      prismaMock.member.update.mockResolvedValue(mockMember);

      await service.verifyCode('anna@choir.de', rawCode);

      expect(prismaMock.memberLoginCode.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: mockCodeRecord.id,
            expiresAt: expect.objectContaining({ gte: expect.any(Date) }),
          }),
        }),
      );
    });

    it('throws UnauthorizedException when code was already consumed concurrently', async () => {
      prismaMock.member.findFirst.mockResolvedValue(mockMember);
      prismaMock.memberLoginCode.findFirst.mockResolvedValue(mockCodeRecord as any);
      prismaMock.memberLoginCode.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.verifyCode('anna@choir.de', rawCode)).rejects.toThrow(UnauthorizedException);
      expect(prismaMock.memberLoginToken.create).not.toHaveBeenCalled();
    });

    it('creates a new MemberLoginToken with hash of returned token', async () => {
      prismaMock.member.findFirst.mockResolvedValue(mockMember);
      prismaMock.memberLoginCode.findFirst.mockResolvedValue(mockCodeRecord as any);
      prismaMock.memberLoginCode.deleteMany.mockResolvedValue({ count: 1 });
      prismaMock.memberLoginToken.create.mockResolvedValue({} as any);
      prismaMock.member.update.mockResolvedValue(mockMember);

      const result = await service.verifyCode('anna@choir.de', rawCode);

      const createCall = prismaMock.memberLoginToken.create.mock.calls[0][0];
      const storedHash = (createCall.data as Record<string, unknown>).hashedToken as string;
      const expectedHash = createHash('sha256').update(result.token).digest('hex');

      expect(storedHash).toBe(expectedHash);
    });

    it('searches member by email (case-insensitive) and code by member/hash/expiry', async () => {
      prismaMock.member.findFirst.mockResolvedValue(mockMember);
      prismaMock.memberLoginCode.findFirst.mockResolvedValue(null);

      await expect(service.verifyCode('ANNA@CHOIR.DE', rawCode)).rejects.toThrow(UnauthorizedException);

      expect(prismaMock.member.findFirst).toHaveBeenCalledWith({
        where: { email: { equals: 'ANNA@CHOIR.DE', mode: 'insensitive' } },
      });
      expect(prismaMock.memberLoginCode.findFirst).toHaveBeenCalledWith({
        where: {
          memberId: mockMember.id,
          hashedCode,
          expiresAt: { gte: expect.any(Date) },
        },
      });
    });

    it('accepts staging bypass code 111111 without requiring a stored login code', async () => {
      isStagingValue = 'true';
      prismaMock.member.findFirst.mockResolvedValue(mockMember);
      prismaMock.memberLoginToken.create.mockResolvedValue({} as any);
      prismaMock.member.update.mockResolvedValue(mockMember);

      const result = await service.verifyCode('anna@choir.de', '111111');

      expect(result.token).toHaveLength(64);
      expect(result.member.id).toBe(mockMember.id);
      expect(prismaMock.memberLoginCode.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.memberLoginCode.deleteMany).not.toHaveBeenCalled();
      expect(prismaMock.memberLoginToken.create).toHaveBeenCalledTimes(1);
    });

    it('rejects bypass code 111111 when staging mode is disabled', async () => {
      isStagingValue = 'false';
      prismaMock.member.findFirst.mockResolvedValue(mockMember);
      prismaMock.memberLoginCode.findFirst.mockResolvedValue(null);

      await expect(service.verifyCode('anna@choir.de', '111111')).rejects.toThrow(UnauthorizedException);
      expect(prismaMock.memberLoginToken.create).not.toHaveBeenCalled();
    });

    it('rejects bypass code 111111 when IS_STAGING is unset', async () => {
      isStagingValue = undefined;
      prismaMock.member.findFirst.mockResolvedValue(mockMember);
      prismaMock.memberLoginCode.findFirst.mockResolvedValue(null);

      await expect(service.verifyCode('anna@choir.de', '111111')).rejects.toThrow(UnauthorizedException);
      expect(prismaMock.memberLoginCode.findFirst).toHaveBeenCalledTimes(1);
      expect(prismaMock.memberLoginToken.create).not.toHaveBeenCalled();
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
      expect(prismaMock.memberLoginToken.delete).not.toHaveBeenCalled();
    });
  });
});
