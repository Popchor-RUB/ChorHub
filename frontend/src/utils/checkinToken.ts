import type { CheckinPayload } from '../types';

function base64UrlToBytes(base64Url: string): Uint8Array {
  const padded = `${base64Url}${'='.repeat((4 - (base64Url.length % 4)) % 4)}`
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function decodePayload(bytes: Uint8Array): CheckinPayload {
  const payload = JSON.parse(new TextDecoder().decode(bytes)) as CheckinPayload;
  if (
    payload.version !== 'v1' ||
    typeof payload.memberId !== 'string' ||
    typeof payload.name !== 'string' ||
    typeof payload.email !== 'string' ||
    typeof payload.issuedAt !== 'string'
  ) {
    throw new Error('invalid payload');
  }
  return payload;
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function parseCheckinToken(token: string): {
  payload: CheckinPayload;
  payloadBytes: Uint8Array;
  signatureBytes: Uint8Array;
} {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') {
    throw new Error('invalid token format');
  }
  const payloadBytes = base64UrlToBytes(parts[1]);
  const signatureBytes = base64UrlToBytes(parts[2]);
  const payload = decodePayload(payloadBytes);
  return { payload, payloadBytes, signatureBytes };
}

export async function verifyCheckinToken(token: string, verificationKey: CryptoKey) {
  const parsed = parseCheckinToken(token);
  const signatureValid = await crypto.subtle.verify(
    { name: 'Ed25519' },
    verificationKey,
    asArrayBuffer(parsed.signatureBytes),
    asArrayBuffer(parsed.payloadBytes),
  );
  return { payload: parsed.payload, signatureValid };
}
