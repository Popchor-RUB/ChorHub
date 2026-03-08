import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
} from '@simplewebauthn/types';

@Injectable()
export class AuthService {
  // sessionId → { adminId, challenge } — adminId is never sent to the client
  private readonly passkeySessionStore = new Map<string, { adminId: string; challenge: string }>();
  // adminId → challenge — for registration (admin is already authenticated via JWT)
  private readonly passkeyRegStore = new Map<string, string>();

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

  async requestMagicLink(email: string): Promise<void> {
    const member = await this.prisma.member.findUnique({ where: { email } });
    if (!member) return; // Silent fail

    const rawToken = randomBytes(32).toString('hex');
    const hashedToken = createHash('sha256').update(rawToken).digest('hex');

    const rawCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedCode = createHash('sha256').update(rawCode).digest('hex');
    const codeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.$transaction([
      this.prisma.memberLoginToken.create({
        data: { memberId: member.id, hashedToken },
      }),
      this.prisma.member.update({
        where: { email },
        data: { loginCode: hashedCode, loginCodeExpiresAt: codeExpiresAt },
      }),
    ]);

    const magicUrl = `${this.config.getOrThrow<string>('APP_URL')}/auth/verify?token=${rawToken}`;
    await this.mailService.sendMagicLink(member, magicUrl, rawToken, rawCode);
  }

  async verifyCode(email: string, code: string) {
    const hashedCode = createHash('sha256').update(code).digest('hex');
    const member = await this.prisma.member.findUnique({ where: { email } });

    if (
      !member ||
      member.loginCode !== hashedCode ||
      !member.loginCodeExpiresAt ||
      member.loginCodeExpiresAt < new Date()
    ) {
      throw new UnauthorizedException('Ungültiger oder abgelaufener Code');
    }

    // Issue a permanent session token and clear the one-time code
    const rawToken = randomBytes(32).toString('hex');
    const hashedToken = createHash('sha256').update(rawToken).digest('hex');
    await this.prisma.$transaction([
      this.prisma.memberLoginToken.create({
        data: { memberId: member.id, hashedToken },
      }),
      this.prisma.member.update({
        where: { id: member.id },
        data: { loginCode: null, loginCodeExpiresAt: null },
      }),
    ]);

    return {
      token: rawToken,
      member: {
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        choirVoice: member.choirVoice,
      },
    };
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
    return {
      token: rawToken,
      member: {
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        choirVoice: member.choirVoice,
      },
    };
  }

  async getPasskeyAuthChallenge(username: string) {
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:5173');
    const rpID = new URL(appUrl).hostname;
    const admin = await this.prisma.adminUser.findUnique({
      where: { username },
      include: { passkeyCredentials: true },
    });

    // Generate a random sessionId regardless of whether the user exists.
    // This prevents username enumeration — the response shape is always identical.
    const sessionId = randomBytes(16).toString('hex');

    if (!admin) {
      // Return a real-looking challenge that will silently fail on verify.
      const fakeOptions = await generateAuthenticationOptions({ rpID, allowCredentials: [] });
      return { options: fakeOptions, sessionId };
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: admin.passkeyCredentials.map((c) => ({
        id: c.credentialId,
        transports: c.transports as AuthenticatorTransportFuture[],
      })),
    });

    this.passkeySessionStore.set(sessionId, { adminId: admin.id, challenge: options.challenge });
    return { options, sessionId };
  }

  async verifyPasskeyAuth(sessionId: string, assertion: AuthenticationResponseJSON) {
    const session = this.passkeySessionStore.get(sessionId);
    if (!session) {
      throw new UnauthorizedException('Keine aktive Passkey-Challenge');
    }
    // Consume the session immediately to prevent replay
    this.passkeySessionStore.delete(sessionId);

    const { adminId, challenge: expectedChallenge } = session;
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
      include: { passkeyCredentials: true },
    });
    if (!admin) throw new UnauthorizedException();

    const credential = admin.passkeyCredentials.find(
      (c) => c.credentialId === assertion.id,
    );
    if (!credential) throw new UnauthorizedException('Passkey nicht gefunden');

    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:5173');
    const verification = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge,
      expectedOrigin: appUrl,
      expectedRPID: new URL(appUrl).hostname,
      credential: {
        id: credential.credentialId,
        publicKey: credential.publicKey,
        counter: Number(credential.counter),
        transports: credential.transports as AuthenticatorTransportFuture[],
      },
    });

    if (!verification.verified) throw new UnauthorizedException('Passkey-Verifizierung fehlgeschlagen');

    await this.prisma.passkeyCredential.update({
      where: { id: credential.id },
      data: { counter: verification.authenticationInfo.newCounter },
    });

    return this.signAdminJwt(admin);
  }

  async getPasskeyRegisterChallenge(adminId: string) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
      include: { passkeyCredentials: true },
    });
    if (!admin) throw new NotFoundException();

    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:5173');
    const options = await generateRegistrationOptions({
      rpName: 'ChorHub',
      rpID: new URL(appUrl).hostname,
      userName: admin.username,
      excludeCredentials: admin.passkeyCredentials.map((c) => ({
        id: c.credentialId,
        transports: c.transports as AuthenticatorTransportFuture[],
      })),
    });

    this.passkeyRegStore.set(adminId, options.challenge);
    return options;
  }

  async verifyPasskeyRegister(adminId: string, attestation: RegistrationResponseJSON) {
    const expectedChallenge = this.passkeyRegStore.get(adminId);
    if (!expectedChallenge) {
      throw new BadRequestException('Keine aktive Registrierungs-Challenge');
    }

    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:5173');
    const verification = await verifyRegistrationResponse({
      response: attestation,
      expectedChallenge,
      expectedOrigin: appUrl,
      expectedRPID: new URL(appUrl).hostname,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException('Passkey-Registrierung fehlgeschlagen');
    }

    this.passkeyRegStore.delete(adminId);

    const { credential } = verification.registrationInfo;
    await this.prisma.passkeyCredential.create({
      data: {
        adminUserId: adminId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        deviceType: verification.registrationInfo.credentialDeviceType,
        backedUp: verification.registrationInfo.credentialBackedUp,
        transports: attestation.response.transports ?? [],
      },
    });

    return { success: true };
  }
}
