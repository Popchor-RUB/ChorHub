import { checkinApi } from './api';

let cachedVerificationKeyPromise: Promise<CryptoKey> | null = null;

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: unknown }).response === 'object'
  ) {
    const response = (error as { response?: { status?: unknown; statusText?: unknown } }).response;
    const status = typeof response?.status === 'number' ? response.status : undefined;
    const statusText = typeof response?.statusText === 'string' ? response.statusText : '';
    if (status) return `HTTP ${status}${statusText ? ` ${statusText}` : ''}`;
  }

  return String(error);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function getCheckinVerificationKey(forceReload = false): Promise<CryptoKey> {
  if (forceReload || !cachedVerificationKeyPromise) {
    cachedVerificationKeyPromise = (async () => {
      let publicKeyBase64: string;
      try {
        const res = await checkinApi.getPublicKey();
        publicKeyBase64 = res.data.publicKey;
      } catch (error) {
        throw new Error(`Could not fetch public key: ${describeError(error)}`);
      }

      try {
        const keyBytes = base64ToBytes(publicKeyBase64);
        return await crypto.subtle.importKey('spki', asArrayBuffer(keyBytes), { name: 'Ed25519' }, false, ['verify']);
      } catch (error) {
        throw new Error(`Could not import Ed25519 key in this browser: ${describeError(error)}`);
      }
    })();
  }

  return cachedVerificationKeyPromise;
}
