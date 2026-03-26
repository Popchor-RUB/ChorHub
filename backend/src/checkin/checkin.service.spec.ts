import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { generateKeyPairSync } from 'crypto';
import { CheckinService } from './checkin.service';

describe('CheckinService', () => {
  let service: CheckinService;

  beforeEach(async () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const privateKeyDer = privateKey.export({ type: 'pkcs8', format: 'der' }) as Buffer;
    const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
    const privateKeyBase64 = privateKeyDer.toString('base64');
    const publicKeyBase64 = publicKeyDer.toString('base64');

    const module = await Test.createTestingModule({
      providers: [
        CheckinService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === 'QR_CHECKIN_PRIVATE_KEY_BASE64') return privateKeyBase64;
              if (key === 'QR_CHECKIN_PUBLIC_KEY_BASE64') return publicKeyBase64;
              throw new Error(`Unexpected config key ${key}`);
            },
          },
        },
      ],
    }).compile();

    service = module.get(CheckinService);
  });

  it('creates deterministic signatures for the same payload', () => {
    const payload = service.createPayload(
      { id: 'member-1', firstName: 'Anna', lastName: 'Muster', email: 'anna@example.com' },
      new Date('2026-03-26T12:00:00.000Z'),
    );

    const tokenA = service.createSignedToken(payload);
    const tokenB = service.createSignedToken(payload);

    expect(tokenA).toBe(tokenB);
  });

  it('verifies a valid token and returns its payload', () => {
    const payload = service.createPayload(
      { id: 'member-1', firstName: 'Anna', lastName: 'Muster', email: 'anna@example.com' },
      new Date('2026-03-26T12:00:00.000Z'),
    );
    const token = service.createSignedToken(payload);

    const result = service.verifyToken(token);
    expect(result.valid).toBe(true);
    expect(result.payload).toEqual(payload);
  });

  it('rejects tampered payload values', () => {
    const payload = service.createPayload(
      { id: 'member-1', firstName: 'Anna', lastName: 'Muster', email: 'anna@example.com' },
      new Date('2026-03-26T12:00:00.000Z'),
    );
    const token = service.createSignedToken(payload);
    const [prefix, encodedPayload, encodedSignature] = token.split('.');

    const tamperedPayload = {
      ...JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')),
      email: 'mallory@example.com',
    };
    const tamperedToken = `${prefix}.${Buffer.from(JSON.stringify(tamperedPayload)).toString('base64url')}.${encodedSignature}`;

    const result = service.verifyToken(tamperedToken);
    expect(result.valid).toBe(false);
  });

  it('rejects unsupported versions', () => {
    const payload = service.createPayload(
      { id: 'member-1', firstName: 'Anna', lastName: 'Muster', email: 'anna@example.com' },
      new Date('2026-03-26T12:00:00.000Z'),
    );
    const token = service.createSignedToken(payload);
    const unsupported = token.replace(/^v1\./, 'v2.');

    const result = service.verifyToken(unsupported);
    expect(result.valid).toBe(false);
  });

  it('generates a data URL QR image', async () => {
    const result = await service.generateMemberCheckinQr({
      id: 'member-1',
      firstName: 'Anna',
      lastName: 'Muster',
      email: 'anna@example.com',
    });

    expect(result.token.startsWith('v1.')).toBe(true);
    expect(result.qrCodeDataUrl.startsWith('data:image/svg+xml;base64,')).toBe(true);
  });
});
