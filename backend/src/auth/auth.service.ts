import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';

@Injectable()
export class AuthService {
  private static readonly STAGING_OTP_BYPASS_CODE = '111111';

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async validateAdminPassword(username: string, password: string) {
    const admin = await this.prisma.adminUser.findUnique({ where: { username } });
    if (!admin || !admin.passwordHash) return null;
    const valid = await bcrypt.compare(password, admin.passwordHash);
    return valid ? admin : null;
  }

  signAdminJwt(admin: { id: string; username: string }) {
    return this.jwtService.sign(
      { sub: admin.id, username: admin.username, role: 'admin' },
    );
  }

  async recordAdminAuthenticationSuccess(
    admin: { id: string; username: string },
    ipAddress: string,
  ): Promise<void> {
    const message = `Admin authenticated successfully (username=${admin.username}, ip=${ipAddress})`;
    await this.prisma.adminAuditLog.create({
      data: {
        adminUserId: admin.id,
        username: admin.username,
        action: 'ADMIN_LOGIN_SUCCESS',
        message,
        ipAddress,
      },
    });
  }

  async issueMemberMagicLink(memberId: string): Promise<{
    rawToken: string;
    loginCode: string;
    magicUrl: string;
  }> {
    const rawToken = randomBytes(32).toString('hex');
    const hashedToken = createHash('sha256').update(rawToken).digest('hex');

    const loginCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedCode = createHash('sha256').update(loginCode).digest('hex');
    const codeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.$transaction([
      this.prisma.memberLoginCode.deleteMany({
        where: { memberId, expiresAt: { lt: new Date() } },
      }),
      this.prisma.memberLoginToken.create({
        data: { memberId, hashedToken },
      }),
      this.prisma.memberLoginCode.create({
        data: { memberId, hashedCode, expiresAt: codeExpiresAt },
      }),
    ]);

    const magicUrl = `${this.config.getOrThrow<string>('APP_URL')}/auth/verify?token=${rawToken}`;
    return { rawToken, loginCode, magicUrl };
  }

  async requestMagicLink(email: string): Promise<void> {
    const member = await this.prisma.member.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (!member) {
      throw new UnauthorizedException('Ungültige Zugangsdaten');
    }

    const { magicUrl, rawToken, loginCode } = await this.issueMemberMagicLink(member.id);
    await this.mailService.sendMagicLink(member, magicUrl, rawToken, loginCode);
  }

  async verifyCode(email: string, code: string) {
    const member = await this.prisma.member.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });

    if (!member) {
      throw new UnauthorizedException('Ungültiger oder abgelaufener Code');
    }

    if (this.isStaging()) {
      return this.verifyCodeInStagingMode(member, code);
    }
    return this.verifyCodeInDefaultMode(member, code);
  }

  private async verifyCodeInStagingMode(
    member: { id: string; firstName: string; lastName: string; email: string },
    code: string,
  ) {
    if (code === AuthService.STAGING_OTP_BYPASS_CODE) {
      return this.issueMemberSessionToken(member);
    }

    const codeRecord = await this.findValidCodeRecord(member.id, code);
    if (!codeRecord) {
      throw new UnauthorizedException('Ungültiger oder abgelaufener Code');
    }
    await this.consumeCodeOrThrow(codeRecord.id);
    return this.issueMemberSessionToken(member);
  }

  private async verifyCodeInDefaultMode(
    member: { id: string; firstName: string; lastName: string; email: string },
    code: string,
  ) {
    const codeRecord = await this.findValidCodeRecord(member.id, code);
    if (!codeRecord) {
      throw new UnauthorizedException('Ungültiger oder abgelaufener Code');
    }
    await this.consumeCodeOrThrow(codeRecord.id);
    return this.issueMemberSessionToken(member);
  }

  private async findValidCodeRecord(memberId: string, code: string) {
    const hashedCode = createHash('sha256').update(code).digest('hex');
    return this.prisma.memberLoginCode.findFirst({
      where: {
        memberId,
        hashedCode,
        expiresAt: { gte: new Date() },
      },
    });
  }

  private async consumeCodeOrThrow(codeId: string): Promise<void> {
    const consumed = await this.prisma.memberLoginCode.deleteMany({
      where: {
        id: codeId,
        expiresAt: { gte: new Date() },
      },
    });
    if (consumed.count !== 1) {
      throw new UnauthorizedException('Ungültiger oder abgelaufener Code');
    }
  }

  private async issueMemberSessionToken(member: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  }) {
    const rawToken = randomBytes(32).toString('hex');
    const hashedToken = createHash('sha256').update(rawToken).digest('hex');

    await this.prisma.$transaction(async (tx) => {
      await tx.memberLoginToken.create({
        data: { memberId: member.id, hashedToken },
      });
      await tx.member.update({
        where: { id: member.id },
        data: { lastLoginAt: new Date() },
      });
    });

    return {
      token: rawToken,
      member: {
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
      },
    };
  }

  private isStaging(): boolean {
    const raw = this.config.get<string>('IS_STAGING', 'false');
    return raw.toLowerCase() === 'true';
  }

  async verifyMagicLink(rawToken: string) {
    const hashedToken = createHash('sha256').update(rawToken).digest('hex');
    const tokenRecord = await this.prisma.memberLoginToken.findUnique({
      where: { hashedToken },
      include: { member: true },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Ungültiger oder abgelaufener Link');
    }

    const { member } = tokenRecord;
    await this.prisma.member.update({
      where: { id: member.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      token: rawToken,
      member: {
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
      },
    };
  }
}
