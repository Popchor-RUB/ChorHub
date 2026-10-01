import type { AdminEmailJobKind } from '../../../types';

type AttachmentFingerprint = { name: string; size: number; digest: string };

function fallbackDigest(bytes: Uint8Array): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (const byte of bytes) {
    first = Math.imul(first ^ byte, 0x01000193);
    second = Math.imul(second ^ byte, 0x85ebca6b);
  }
  return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`;
}

async function digest(bytes: Uint8Array): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const result = await globalThis.crypto.subtle.digest('SHA-256', copy.buffer);
    return Array.from(new Uint8Array(result), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  return fallbackDigest(bytes);
}

function newUuid(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function readStorage(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function writeStorage(key: string, value: string): void {
  try { window.localStorage.setItem(key, value); } catch { /* Browser storage may be disabled. */ }
}

function removeStorage(key: string): void {
  try { window.localStorage.removeItem(key); } catch { /* Browser storage may be disabled. */ }
}

export async function getEmailPayloadFingerprint(input: {
  subject: string;
  markdownContent: string;
  signatureMarkdown: string;
  attachments: File[];
}): Promise<string> {
  const attachments: AttachmentFingerprint[] = await Promise.all(input.attachments.map(async (file) => {
    const bytes = await file.arrayBuffer();
    return { name: file.name, type: file.type, size: file.size, digest: await digest(new Uint8Array(bytes)) };
  }));
  const payload = JSON.stringify({
    subject: input.subject.trim(),
    markdownContent: input.markdownContent,
    signatureMarkdown: input.signatureMarkdown,
    attachments,
  });
  return digest(new TextEncoder().encode(payload));
}

type SavedSubmission = { fingerprint: string; key: string; acceptedJobId: string | null };
const memorySubmissions = new Map<AdminEmailJobKind, SavedSubmission>();
const memoryRetryKeys = new Map<string, string>();

function storageKey(kind: AdminEmailJobKind): string {
  return `chorhub-admin-email-submission:${kind}`;
}

export function getEmailSubmissionKey(kind: AdminEmailJobKind, fingerprint: string): SavedSubmission {
  const inMemory = memorySubmissions.get(kind);
  if (inMemory?.fingerprint === fingerprint) return inMemory;
  const key = storageKey(kind);
  const saved = readStorage(key);
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as SavedSubmission;
      if (parsed.fingerprint === fingerprint) {
        memorySubmissions.set(kind, parsed);
        return parsed;
      }
    } catch {
      removeStorage(key);
    }
  }
  const submission = { fingerprint, key: newUuid(), acceptedJobId: null };
  memorySubmissions.set(kind, submission);
  writeStorage(key, JSON.stringify(submission));
  return submission;
}

export function saveAcceptedEmailJob(kind: AdminEmailJobKind, submission: SavedSubmission, jobId: string): void {
  const accepted = { ...submission, acceptedJobId: jobId };
  memorySubmissions.set(kind, accepted);
  writeStorage(storageKey(kind), JSON.stringify(accepted));
}

export function clearEmailSubmission(kind: AdminEmailJobKind, fingerprint: string): void {
  const inMemory = memorySubmissions.get(kind);
  if (inMemory?.fingerprint === fingerprint) memorySubmissions.delete(kind);
  const key = storageKey(kind);
  const saved = readStorage(key);
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved) as SavedSubmission;
    if (parsed.fingerprint === fingerprint) {
      removeStorage(key);
    }
  } catch {
    removeStorage(key);
    memorySubmissions.delete(kind);
  }
}

export function getEmailRetryKey(jobId: string): string {
  const inMemory = memoryRetryKeys.get(jobId);
  if (inMemory) return inMemory;
  const storageName = `chorhub-admin-email-retry:${jobId}`;
  const existing = readStorage(storageName);
  if (existing) {
    memoryRetryKeys.set(jobId, existing);
    return existing;
  }
  const key = newUuid();
  memoryRetryKeys.set(jobId, key);
  writeStorage(storageName, key);
  return key;
}

export function clearEmailRetryKey(jobId: string): void {
  memoryRetryKeys.delete(jobId);
  removeStorage(`chorhub-admin-email-retry:${jobId}`);
}
