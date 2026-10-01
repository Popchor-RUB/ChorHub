import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadMailTemplateDefaults } from '../src/mail/load-mail-template-defaults';
import { hashMailTemplateHtml } from '../src/mail/hash-mail-template';
import { MAIL_TEMPLATE_HASHES } from '../src/mail/mail-template-hashes';
import {
  appendMailTemplateHashes,
  findMissingMailTemplateHashes,
  formatMailTemplateHashRegistry,
} from '../src/mail/mail-template-hash-maintenance';

const usage = 'Usage: npm run mail:template-hashes -- --append | --check';

async function run(): Promise<void> {
  const [mode, ...extraArguments] = process.argv.slice(2);
  if (extraArguments.length > 0 || !['--append', '--check'].includes(mode ?? '')) {
    console.error(usage);
    process.exitCode = 2;
    return;
  }

  const defaults = await loadMailTemplateDefaults();
  const currentHashes = defaults.map(({ key, htmlTemplate }) => ({
    key,
    hash: hashMailTemplateHtml(htmlTemplate),
  }));

  if (mode === '--check') {
    const missing = findMissingMailTemplateHashes(MAIL_TEMPLATE_HASHES, currentHashes);
    if (missing.length === 0) {
      console.log(`All ${currentHashes.length} current mail template hashes are registered.`);
      return;
    }

    for (const { key, hash } of missing) console.error(`${key}: missing ${hash}`);
    process.exitCode = 1;
    return;
  }

  const updated = appendMailTemplateHashes(MAIL_TEMPLATE_HASHES, currentHashes);
  const path = resolve(process.cwd(), 'src/mail/mail-template-hashes.ts');
  const source = formatMailTemplateHashRegistry(updated);
  const existingSource = await readFile(path, 'utf8');
  if (source !== existingSource) await writeFile(path, source, 'utf8');
  console.log(`Registered ${currentHashes.length} current mail template hash(es) in ${path}.`);
}

void run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
