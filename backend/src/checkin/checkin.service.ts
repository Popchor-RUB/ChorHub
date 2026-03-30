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
  private static readonly QR_CLUSTER_BASE_FILL = '#111111';
  private static readonly QR_CLUSTER_HIGHLIGHT_FILL = '#6f8fa3';
  private static readonly MAX_ANIMATED_CLUSTERS = 20;
  private static readonly QR_ANIMATION_STYLE = `<style>
.qr-animated-cluster {
  fill: ${CheckinService.QR_CLUSTER_BASE_FILL};
  animation-name: qr-cluster-color;
  animation-duration: var(--qr-cluster-duration, 26000ms);
  animation-delay: var(--qr-cluster-delay, 0ms);
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  will-change: fill;
}
@keyframes qr-cluster-color {
  0% { fill: ${CheckinService.QR_CLUSTER_BASE_FILL}; }
  44% { fill: ${CheckinService.QR_CLUSTER_BASE_FILL}; }
  56% { fill: var(--qr-cluster-highlight-a, ${CheckinService.QR_CLUSTER_HIGHLIGHT_FILL}); }
  68% { fill: ${CheckinService.QR_CLUSTER_BASE_FILL}; }
  100% { fill: ${CheckinService.QR_CLUSTER_BASE_FILL}; }
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

    const shapesByModule = new Map<string, string[]>();
    const allShapeMarkups: string[] = [];
    const moduleKeys = new Set<string>();
    const maskRegex = /<mask id="mask-(?:dot|corners-square|corners-dot)-[^"]+"[^>]*>([\s\S]*?)<\/mask>/g;
    const shapeRegex = /<(path|rect|circle|ellipse)([^>]*?)\/>/g;
    for (const maskMatch of svg.matchAll(maskRegex)) {
      const maskBody = maskMatch[1];
      for (const shapeMatch of maskBody.matchAll(shapeRegex)) {
        const tagName = shapeMatch[1];
        const tagAttrs = shapeMatch[2];
        const moduleKey = this.getShapeModuleKey(tagName, tagAttrs);
        if (!moduleKey) continue;

        moduleKeys.add(moduleKey);
        const shapeMarkup = `<${tagName}${this.stripShapeFillAttributes(tagAttrs)}/>`;
        allShapeMarkups.push(shapeMarkup);
        const moduleShapes = shapesByModule.get(moduleKey) ?? [];
        moduleShapes.push(shapeMarkup);
        shapesByModule.set(moduleKey, moduleShapes);
      }
    }

    const clusterByModule = this.buildModuleClusters(moduleKeys);
    const clusterSizeMap = new Map<number, number>();
    for (const clusterId of clusterByModule.values()) {
      clusterSizeMap.set(clusterId, (clusterSizeMap.get(clusterId) ?? 0) + 1);
    }

    const animatedClusterIds = [...clusterSizeMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, CheckinService.MAX_ANIMATED_CLUSTERS)
      .map(([clusterId]) => clusterId);
    if (animatedClusterIds.length === 0) return svg;

    const animatedClusterIdSet = new Set(animatedClusterIds);
    const shapesByCluster = new Map<number, string[]>();
    for (const [moduleKey, shapeMarkups] of shapesByModule.entries()) {
      const clusterId = clusterByModule.get(moduleKey);
      if (clusterId === undefined || !animatedClusterIdSet.has(clusterId)) continue;
      const clusterShapes = shapesByCluster.get(clusterId) ?? [];
      clusterShapes.push(...shapeMarkups);
      shapesByCluster.set(clusterId, clusterShapes);
    }

    const animatedClusterGroups: string[] = [];
    for (const [clusterId, shapeMarkups] of shapesByCluster.entries()) {
      const clusterSize = clusterSizeMap.get(clusterId) ?? 1;
      const durationMs = Math.round(this.randomInRange(20000, 32000));
      const delayMs = -Math.round(this.randomInRange(0, durationMs * 6));
      const highlightA = this.randomBlueHighlightColor();
      const animationVars = [
        `--qr-cluster-delay:${delayMs}ms`,
        `--qr-cluster-duration:${durationMs}ms`,
        `--qr-cluster-highlight-a:${highlightA}`,
        'opacity:0.80',
      ].join(';');
      animatedClusterGroups.push(
        `<g class="qr-animated-cluster" style="${animationVars}">${shapeMarkups.join('')}</g>`,
      );
    }
    const staticBaseGroup = `<g id="qr-static-modules" fill="${CheckinService.QR_CLUSTER_BASE_FILL}" aria-hidden="true">${allShapeMarkups.join('')}</g>`;
    const overlayGroup = `<g id="qr-animated-clusters" aria-hidden="true">${animatedClusterGroups.join('')}</g>`;
    const withoutMaskedBlackLayer = svg.replace(
      /<rect([^>]*\sstyle="[^"]*mask:url\(#mask-(?:dot|corners-square|corners-dot)-[^)]+\)[^"]*"[^>]*\sfill="#111111"[^>]*)\/>/g,
      '',
    );
    const withAnimatedForeground = withoutMaskedBlackLayer.replace(
      '</svg>',
      `${staticBaseGroup}${overlayGroup}</svg>`,
    );

    if (withAnimatedForeground.includes('<defs>')) {
      return withAnimatedForeground.replace(
        '<defs>',
        `<defs>${CheckinService.QR_ANIMATION_STYLE}`,
      );
    }

    return withAnimatedForeground.replace(
      /<svg\b[^>]*>/,
      (match) => `${match}<defs>${CheckinService.QR_ANIMATION_STYLE}</defs>`,
    );
  }

  private getShapeModuleKey(tagName: string, tagAttrs: string): string | null {
    const center = this.getShapeCenter(tagName, tagAttrs);
    if (!center) return null;

    const moduleX = Math.round((center.x - 35) / 10);
    const moduleY = Math.round((center.y - 35) / 10);
    return `${moduleX},${moduleY}`;
  }

  private getShapeCenter(tagName: string, tagAttrs: string): { x: number; y: number } | null {
    const transform = this.getShapeAttribute(tagAttrs, 'transform');
    if (transform) {
      const rotateMatch = transform.match(/rotate\([^,]+,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/);
      if (rotateMatch) {
        return {
          x: Number(rotateMatch[1]),
          y: Number(rotateMatch[2]),
        };
      }
    }

    if (tagName === 'circle' || tagName === 'ellipse') {
      const cx = Number(this.getShapeAttribute(tagAttrs, 'cx'));
      const cy = Number(this.getShapeAttribute(tagAttrs, 'cy'));
      if (!Number.isNaN(cx) && !Number.isNaN(cy)) {
        return { x: cx, y: cy };
      }
    }

    if (tagName === 'rect') {
      const x = Number(this.getShapeAttribute(tagAttrs, 'x'));
      const y = Number(this.getShapeAttribute(tagAttrs, 'y'));
      const width = Number(this.getShapeAttribute(tagAttrs, 'width'));
      const height = Number(this.getShapeAttribute(tagAttrs, 'height'));
      if (![x, y, width, height].some(Number.isNaN)) {
        return {
          x: x + width / 2,
          y: y + height / 2,
        };
      }
    }

    if (tagName === 'path') {
      const d = this.getShapeAttribute(tagAttrs, 'd');
      if (!d) return null;
      const moveMatch = d.match(/M\s*([-\d.]+)\s+([-\d.]+)/);
      if (!moveMatch) return null;
      return {
        x: Number(moveMatch[1]) + 5,
        y: Number(moveMatch[2]) + 5,
      };
    }

    return null;
  }

  private getShapeAttribute(tagAttrs: string, attributeName: string): string | null {
    const attributeMatch = tagAttrs.match(new RegExp(`${attributeName}="([^"]+)"`));
    return attributeMatch ? attributeMatch[1] : null;
  }

  private stripShapeFillAttributes(tagAttrs: string): string {
    const withoutFillAttribute = tagAttrs.replace(/\sfill="[^"]*"/g, '');
    return withoutFillAttribute.replace(/style="([^"]*)"/g, (_styleMatch, styleValue: string) => {
      const filteredStyle = styleValue
        .split(';')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0 && !entry.startsWith('fill:'))
        .join(';');
      return filteredStyle.length > 0 ? `style="${filteredStyle}"` : '';
    });
  }

  private buildModuleClusters(moduleKeys: Set<string>): Map<string, number> {
    const moduleKeySet = new Set(moduleKeys);
    const visited = new Set<string>();
    const clusterByModule = new Map<string, number>();
    const neighbors = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    let clusterIndex = 0;

    for (const moduleKey of moduleKeySet) {
      if (visited.has(moduleKey)) continue;

      const stack = [moduleKey];
      visited.add(moduleKey);
      while (stack.length > 0) {
        const currentKey = stack.pop();
        if (!currentKey) continue;
        clusterByModule.set(currentKey, clusterIndex);
        const [xPart, yPart] = currentKey.split(',');
        const x = Number(xPart);
        const y = Number(yPart);
        for (const [dx, dy] of neighbors) {
          const neighborKey = `${x + dx},${y + dy}`;
          if (moduleKeySet.has(neighborKey) && !visited.has(neighborKey)) {
            visited.add(neighborKey);
            stack.push(neighborKey);
          }
        }
      }

      clusterIndex += 1;
    }

    return clusterByModule;
  }

  private randomInRange(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  private randomBlueHighlightColor(): string {
    const hue = Math.round(this.randomInRange(202, 218));
    const saturation = Math.round(this.randomInRange(50, 70));
    const lightness = Math.round(this.randomInRange(70, 85));
    return `hsl(${hue} ${saturation}% ${lightness}%)`;
  }

  private randomBlueHighlightPalette(): [string, string, string] {
    return [
      this.randomBlueHighlightColor(),
      this.randomBlueHighlightColor(),
      this.randomBlueHighlightColor(),
    ];
  }
}
