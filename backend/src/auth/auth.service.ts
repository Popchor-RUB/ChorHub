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
  RegistrationResponseJSON,
} from '@simplewebauthn/types';

@Injectable()
export class AuthService {
  private passkeyChallengStore = new Map<string, string>();

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

    await this.prisma.member.update({
      where: { email },
      data: { loginToken: hashedToken },
    });

    const magicUrl = `${this.config.get('APP_URL')}/auth/verify?token=${rawToken}`;
    await this.mailService.sendMagicLink(member, magicUrl, rawToken);
  }

  async verifyMagicLink(rawToken: string) {
    const hashedToken = createHash('sha256').update(rawToken).digest('hex');
    const member = await this.prisma.member.findUnique({
      where: { loginToken: hashedToken },
    });

    if (!member) {
      throw new UnauthorizedException('Ungültiger oder abgelaufener Link');
    }

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
    const admin = await this.prisma.adminUser.findUnique({
      where: { username },
      include: { passkeyCredentials: true },
    });
    if (!admin) {
      throw new NotFoundException('Benutzer nicht gefunden');
    }

    const options = await generateAuthenticationOptions({
      rpID: new URL(this.config.get('APP_URL', 'http://localhost:5173')).hostname,
      allowCredentials: admin.passkeyCredentials.map((c) => ({
        id: c.credentialId,
        transports: c.transports as any[],
      })),
    });

    this.passkeyChallengStore.set(admin.id, options.challenge);
    return { options, adminId: admin.id };
  }

  async verifyPasskeyAuth(adminId: string, assertion: AuthenticationResponseJSON) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
      include: { passkeyCredentials: true },
    });
    if (!admin) throw new UnauthorizedException();

    const expectedChallenge = this.passkeyChallengStore.get(adminId);
    if (!expectedChallenge) {
      throw new UnauthorizedException('Keine aktive Passkey-Challenge');
    }

    const credential = admin.passkeyCredentials.find(
      (c) => c.credentialId === assertion.id,
    );
    if (!credential) throw new UnauthorizedException('Passkey nicht gefunden');

    const verification = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge,
      expectedOrigin: this.config.get('APP_URL', 'http://localhost:5173'),
      expectedRPID: new URL(this.config.get('APP_URL', 'http://localhost:5173')).hostname,
      credential: {
        id: credential.credentialId,
        publicKey: credential.publicKey,
        counter: Number(credential.counter),
        transports: credential.transports as any[],
      },
    });

    if (!verification.verified) throw new UnauthorizedException('Passkey-Verifizierung fehlgeschlagen');

    this.passkeyChallengStore.delete(adminId);
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

    const options = await generateRegistrationOptions({
      rpName: 'ChorHub',
      rpID: new URL(this.config.get('APP_URL', 'http://localhost:5173')).hostname,
      userName: admin.username,
      excludeCredentials: admin.passkeyCredentials.map((c) => ({
        id: c.credentialId,
        transports: c.transports as any[],
      })),
    });

    this.passkeyChallengStore.set(`reg-${adminId}`, options.challenge);
    return options;
  }

  async verifyPasskeyRegister(adminId: string, attestation: RegistrationResponseJSON) {
    const expectedChallenge = this.passkeyChallengStore.get(`reg-${adminId}`);
    if (!expectedChallenge) {
      throw new BadRequestException('Keine aktive Registrierungs-Challenge');
    }

    const verification = await verifyRegistrationResponse({
      response: attestation,
      expectedChallenge,
      expectedOrigin: this.config.get('APP_URL', 'http://localhost:5173'),
      expectedRPID: new URL(this.config.get('APP_URL', 'http://localhost:5173')).hostname,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException('Passkey-Registrierung fehlgeschlagen');
    }

    this.passkeyChallengStore.delete(`reg-${adminId}`);

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
