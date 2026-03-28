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
      { id: 'member-1', firstName: 'Anna', lastName: 'Muster' },
      new Date('2026-03-26T12:00:00.000Z'),
    );

    const tokenA = service.createSignedToken(payload);
    const tokenB = service.createSignedToken(payload);

    expect(tokenA).toBe(tokenB);
  });

  it('verifies a valid token and returns its payload', () => {
    const payload = service.createPayload(
      { id: 'member-1', firstName: 'Anna', lastName: 'Muster' },
      new Date('2026-03-26T12:00:00.000Z'),
    );
    const token = service.createSignedToken(payload);

    const result = service.verifyToken(token);
    expect(result.valid).toBe(true);
    expect(result.payload).toEqual(payload);
  });

  it('rejects tampered payload values', () => {
    const payload = service.createPayload(
      { id: 'member-1', firstName: 'Anna', lastName: 'Muster' },
      new Date('2026-03-26T12:00:00.000Z'),
    );
    const token = service.createSignedToken(payload);
    const [prefix, encodedPayload, encodedSignature] = token.split('.');

    const tamperedPayload = {
      ...JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')),
      name: 'Mallory',
    };
    const tamperedToken = `${prefix}.${Buffer.from(JSON.stringify(tamperedPayload)).toString('base64url')}.${encodedSignature}`;

    const result = service.verifyToken(tamperedToken);
    expect(result.valid).toBe(false);
  });

  it('rejects unsupported versions', () => {
    const payload = service.createPayload(
      { id: 'member-1', firstName: 'Anna', lastName: 'Muster' },
      new Date('2026-03-26T12:00:00.000Z'),
    );
    const token = service.createSignedToken(payload);
    const unsupported = token.replace(/^v1\./, 'v2.');

    const result = service.verifyToken(unsupported);
    expect(result.valid).toBe(false);
  });

  it('generates a data URL QR image', async () => {
    const qrModuleMock = {
      QRCodeJs: class {
        async serialize() {
          return '<svg xmlns="http://www.w3.org/2000/svg"><defs><mask id="mask-dot-color-0-0" maskUnits="userSpaceOnUse" x="0" y="0" width="230" height="230"><g fill="#fff"><path d="M 10 100 v 10 h 5 a 5 5, 0, 0, 0, 0 -10 z" transform="rotate(180,15,105)"/><circle cx="45" cy="45" r="5"/></g></mask></defs><rect x="0" y="0" width="230" height="230" fill="#ffffff"/><rect x="10" y="10" width="210" height="210" style="mask:url(#mask-dot-color-0-0)" fill="#111111"/></svg>';
        }
      },
      ErrorCorrectionLevel: { H: 'H' },
    };
    jest.spyOn(service as any, 'loadQrCodeModule').mockResolvedValue(qrModuleMock);

    const result = await service.generateMemberCheckinQr({
      id: 'member-1',
      firstName: 'Anna',
      lastName: 'Muster',
    });

    expect(result.token.startsWith('v1.')).toBe(true);
    expect(result.qrCodeDataUrl.startsWith('data:image/svg+xml;base64,')).toBe(true);

    const encodedSvg = result.qrCodeDataUrl.replace('data:image/svg+xml;base64,', '');
    const svg = Buffer.from(encodedSvg, 'base64').toString('utf8');

    expect(svg).toContain('@keyframes qr-blob-color');
    expect(svg).toContain('.qr-animated-blob');
    expect(svg).toContain('fill: #111111;');
    expect(svg).toContain('#6f8fa3');
    expect(svg).toContain('id="qr-animated-blobs"');
    expect(svg).toContain('class="qr-animated-blob"');
    expect(svg).toContain('<circle cx="45" cy="45" r="5" class="qr-animated-blob"');
    expect(svg).toContain('--qr-blob-delay:');
    expect(svg).toContain('--qr-blob-duration:');
    expect(svg).not.toContain('style="mask:url(#mask-dot-color-0-0)" fill="#111111"');
    expect(svg).toContain('<rect x="0" y="0" width="230" height="230" fill="#ffffff"/>');
  });
});
