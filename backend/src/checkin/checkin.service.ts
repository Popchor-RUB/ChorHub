import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPrivateKey, createPublicKey, sign, verify, KeyObject } from 'crypto';
import QRCode from 'qrcode';
import type { Member } from '../generated/prisma/client';

export interface CheckinPayload {
  memberId: string;
  name: string;
  email: string;
  issuedAt: string;
  version: 'v1';
}

@Injectable()
export class CheckinService {
  private readonly privateKey: KeyObject;
  private readonly publicKey: KeyObject;
  private readonly publicKeyBase64: string;

  constructor(private readonly config: ConfigService) {
    const privateKeyBase64 = this.config.getOrThrow<string>('QR_CHECKIN_PRIVATE_KEY_BASE64');
    this.publicKeyBase64 = this.config.getOrThrow<string>('QR_CHECKIN_PUBLIC_KEY_BASE64');

    this.privateKey = createPrivateKey({
      key: Buffer.from(privateKeyBase64, 'base64'),
      format: 'der',
      type: 'pkcs8',
    });
    this.publicKey = createPublicKey({
      key: Buffer.from(this.publicKeyBase64, 'base64'),
      format: 'der',
      type: 'spki',
    });
  }

  async generateMemberCheckinQr(member: Pick<Member, 'id' | 'firstName' | 'lastName' | 'email'>) {
    const payload = this.createPayload(member);
    const token = this.createSignedToken(payload);
    const qrCodeSvg = await QRCode.toString(token, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
    });
    const qrCodeDataUrl = `data:image/svg+xml;base64,${Buffer.from(qrCodeSvg).toString('base64')}`;

    return { token, qrCodeDataUrl };
  }

  getPublicKeyBase64(): string {
    return this.publicKeyBase64;
  }

  createPayload(
    member: Pick<Member, 'id' | 'firstName' | 'lastName' | 'email'>,
    issuedAt = new Date(),
  ): CheckinPayload {
    return {
      memberId: member.id,
      name: `${member.firstName} ${member.lastName}`.trim(),
      email: member.email,
      issuedAt: issuedAt.toISOString(),
      version: 'v1',
    };
  }

  createSignedToken(payload: CheckinPayload): string {
    const payloadBytes = this.serializePayload(payload);
    const signature = sign(null, payloadBytes, this.privateKey);
    return `v1.${payloadBytes.toString('base64url')}.${signature.toString('base64url')}`;
  }

  parseToken(token: string): { payload: CheckinPayload; payloadBytes: Buffer; signature: Buffer } {
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== 'v1') {
      throw new Error('Invalid QR token format');
    }

    const payloadBytes = Buffer.from(parts[1], 'base64url');
    const signature = Buffer.from(parts[2], 'base64url');
    const payload = JSON.parse(payloadBytes.toString('utf8')) as CheckinPayload;

    if (
      payload.version !== 'v1' ||
      typeof payload.memberId !== 'string' ||
      typeof payload.name !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.issuedAt !== 'string'
    ) {
      throw new Error('Invalid QR payload');
    }

    return { payload, payloadBytes, signature };
  }

  verifyToken(token: string): { valid: boolean; payload?: CheckinPayload } {
    try {
      const { payload, payloadBytes, signature } = this.parseToken(token);
      const valid = verify(null, payloadBytes, this.publicKey, signature);
      return valid ? { valid, payload } : { valid };
    } catch {
      return { valid: false };
    }
  }

  private serializePayload(payload: CheckinPayload): Buffer {
    return Buffer.from(JSON.stringify(payload), 'utf8');
  }
}

