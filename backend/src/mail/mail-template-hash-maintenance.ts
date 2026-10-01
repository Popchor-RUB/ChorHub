export type MailTemplateHashMap = Record<string, readonly string[]>;

export interface MailTemplateCurrentHash {
  key: string;
  hash: string;
}

export function appendMailTemplateHashes(
  existing: MailTemplateHashMap,
  current: readonly MailTemplateCurrentHash[],
): Record<string, string[]> {
  const merged = new Map<string, Set<string>>();

  for (const [key, hashes] of Object.entries(existing)) {
    merged.set(key, new Set(hashes));
  }

  for (const { key, hash } of current) {
    const hashes = merged.get(key) ?? new Set<string>();
    hashes.add(hash);
    merged.set(key, hashes);
  }

  return Object.fromEntries(
    [...merged.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, hashes]) => [key, [...hashes].sort()]),
  );
}

export function findMissingMailTemplateHashes(
  existing: MailTemplateHashMap,
  current: readonly MailTemplateCurrentHash[],
): MailTemplateCurrentHash[] {
  return current
    .filter(({ key, hash }) => !existing[key]?.includes(hash))
    .toSorted((left, right) => left.key.localeCompare(right.key) || left.hash.localeCompare(right.hash));
}

export function formatMailTemplateHashRegistry(hashes: MailTemplateHashMap): string {
  const entries = Object.entries(hashes)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, values]) => {
      const hashLines = [...new Set(values)].sort().map((hash) => `    ${JSON.stringify(hash)},`).join('\n');
      return `  ${JSON.stringify(key)}: [\n${hashLines}\n  ],`;
    });

  return [
    "import type { MailTemplateKey } from './mail-template.types';",
    '',
    'export const MAIL_TEMPLATE_HASHES: Record<MailTemplateKey, readonly string[]> = {',
    ...entries,
    '};',
    '',
  ].join('\n');
}
