import { checkinApi } from './api';

let cachedVerificationKeyPromise: Promise<CryptoKey> | null = null;

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
      const res = await checkinApi.getPublicKey();
      const keyBytes = base64ToBytes(res.data.publicKey);
      return crypto.subtle.importKey('spki', asArrayBuffer(keyBytes), { name: 'Ed25519' }, false, ['verify']);
    })();
  }

  return cachedVerificationKeyPromise;
}
