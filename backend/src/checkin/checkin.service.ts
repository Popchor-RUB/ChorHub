import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPrivateKey, createPublicKey, sign, verify, KeyObject } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import type { Member } from '../generated/prisma/client';

export interface CheckinPayload {
  memberId: string;
  name: string;
  issuedAt: string;
  version: 'v1';
}

export interface MemberCheckinQrResponse {
  token: string;
  qrCodeDataUrl: string;
}

@Injectable()
export class CheckinService {
  private static readonly QR_BLOB_BASE_FILL = '#111111';
  private static readonly QR_BLOB_HIGHLIGHT_FILL = '#6f8fa3';
  private static readonly QR_ANIMATION_STYLE = `<style>
.qr-animated-blob {
  fill: ${CheckinService.QR_BLOB_BASE_FILL};
  animation-name: qr-blob-color;
  animation-duration: var(--qr-blob-duration, 2200ms);
  animation-delay: var(--qr-blob-delay, 0ms);
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  animation-direction: alternate;
}
@keyframes qr-blob-color {
  from { fill: ${CheckinService.QR_BLOB_BASE_FILL}; }
  to { fill: ${CheckinService.QR_BLOB_HIGHLIGHT_FILL}; }
}
</style>`;

  private readonly privateKey: KeyObject;
  private readonly publicKey: KeyObject;
  private readonly publicKeyBase64: string;
  private readonly qrLogo: Buffer | null;
  private qrCodeModulePromise: Promise<any> | null = null;

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
    this.qrLogo = this.loadQrLogo();
  }

  async generateMemberCheckinQr(
    member: Pick<Member, 'id' | 'firstName' | 'lastName'>,
  ): Promise<MemberCheckinQrResponse> {
    const payload = this.createPayload(member);
    const token = this.createSignedToken(payload);
    const qrModule = await this.loadQrCodeModule();
    const QRCodeJs = qrModule.QRCodeJs as new (options: Record<string, unknown>) => {
      serialize: () => Promise<string | undefined>;
    };
    const qrCode = new QRCodeJs({
      data: token,
      width: 384,
      height: 384,
      margin: 0,
      dotsOptions: {
        type: 'rounded',
        color: '#111111',
      },
      cornersSquareOptions: {
        type: 'rounded',
        color: '#111111',
      },
      cornersDotOptions: {
        type: 'dot',
        color: '#111111',
      },
      backgroundOptions: {
        color: '#ffffff',
        round: 0.08,
      },
      ...(this.qrLogo
        ? {
            image: this.qrLogo,
            imageOptions: {
              mode: 'center',
              imageSize: 0.4,
              margin: 1,
              padding: 2,
              backgroundColor: '#ffffff',
              radius: '4%',
            },
          }
        : {}),
    });
    const rawQrCodeSvg = (await qrCode.serialize()) ?? '';
    const qrCodeSvg = this.addAnimationToSvg(rawQrCodeSvg);
    const qrCodeDataUrl = `data:image/svg+xml;base64,${Buffer.from(qrCodeSvg).toString('base64')}`;

    return {
      token,
      qrCodeDataUrl,
    };
  }

  getPublicKeyBase64(): string {
    return this.publicKeyBase64;
  }

  createPayload(
    member: Pick<Member, 'id' | 'firstName' | 'lastName'>,
    issuedAt = new Date(),
  ): CheckinPayload {
    return {
      memberId: member.id,
      name: `${member.firstName} ${member.lastName}`.trim(),
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

  private loadQrLogo(): Buffer | null {
    const candidates = [
      path.resolve(process.cwd(), '../frontend/public/icons/icon-512.png'),
      path.resolve(process.cwd(), 'frontend/public/icons/icon-512.png'),
      path.resolve(__dirname, '../../../frontend/public/icons/icon-512.png'),
      path.resolve(__dirname, '../../../../frontend/public/icons/icon-512.png'),
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return readFileSync(candidate);
      }
    }

    return null;
  }

  private loadQrCodeModule(): Promise<any> {
    if (!this.qrCodeModulePromise) {
      const dynamicImport = new Function(
        'modulePath',
        'return import(modulePath)',
      ) as (modulePath: string) => Promise<any>;
      this.qrCodeModulePromise = dynamicImport('@qr-platform/qr-code.js/node');
    }

    return this.qrCodeModulePromise;
  }

  private addAnimationToSvg(svg: string): string {
    if (!svg || !svg.includes('<svg')) return svg;

    const animatedBlobShapes: string[] = [];
    const maskRegex = /<mask id="mask-(?:dot|corners-square|corners-dot)-[^"]+"[^>]*>([\s\S]*?)<\/mask>/g;
    for (const maskMatch of svg.matchAll(maskRegex)) {
      const maskBody = maskMatch[1];
      for (const shapeMatch of maskBody.matchAll(/<(path|rect|circle|ellipse)([^>]*?)\/>/g)) {
        const tagName = shapeMatch[1];
        const tagAttrs = shapeMatch[2];
        const delayMs = -Math.round(this.randomInRange(0, 2800));
        const durationMs = Math.round(this.randomInRange(1400, 3000));
        const animationVars = `--qr-blob-delay:${delayMs}ms;--qr-blob-duration:${durationMs}ms;`;
        const attrsWithClass = tagAttrs.includes('class=')
          ? tagAttrs.replace(/class="([^"]*)"/, 'class="$1 qr-animated-blob"')
          : `${tagAttrs} class="qr-animated-blob"`;
        const attrsWithStyle = attrsWithClass.includes('style=')
          ? attrsWithClass.replace(/style="([^"]*)"/, (_styleMatch, styleValue: string) => {
              const baseStyle = styleValue.trim();
              const separator = baseStyle.endsWith(';') || baseStyle.length === 0 ? '' : ';';
              return `style="${baseStyle}${separator}${animationVars}"`;
            })
          : `${attrsWithClass} style="${animationVars}"`;
        animatedBlobShapes.push(`<${tagName}${attrsWithStyle}/>`);
      }
    }

    const withoutStaticForegroundLayer = svg.replace(
      /<rect([^>]*\sstyle="[^"]*mask:url\(#mask-(?:dot|corners-square|corners-dot)-[^)]+\)[^"]*"[^>]*\sfill="#111111"[^>]*)\/>/g,
      '',
    );
    const overlayGroup = animatedBlobShapes.length > 0
      ? `<g id="qr-animated-blobs" aria-hidden="true">${animatedBlobShapes.join('')}</g>`
      : '';
    const withAnimatedBlobs = overlayGroup
      ? withoutStaticForegroundLayer.replace('</svg>', `${overlayGroup}</svg>`)
      : withoutStaticForegroundLayer;

    if (withAnimatedBlobs.includes('<defs>')) {
      return withAnimatedBlobs.replace(
        '<defs>',
        `<defs>${CheckinService.QR_ANIMATION_STYLE}`,
      );
    }

    return withAnimatedBlobs.replace(
      /<svg\b[^>]*>/,
      (match) => `${match}${CheckinService.QR_ANIMATION_STYLE}`,
    );
  }

  private randomInRange(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }
}
