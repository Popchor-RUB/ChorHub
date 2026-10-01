import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MAIL_TEMPLATE_DEFINITIONS } from './mail-template.catalog';

export async function loadMailTemplateDefaults() {
  const directory = join(__dirname, 'templates');
  const footer = await readFile(join(directory, 'partials', 'footer.hbs'), 'utf8');
  return Promise.all(
    MAIL_TEMPLATE_DEFINITIONS.map(async ({ key, subjectTemplate }) => ({
      key,
      subjectTemplate,
      // Store the complete HTML so admins can customize the footer too.
      htmlTemplate: (await readFile(join(directory, `${key}.hbs`), 'utf8'))
        .replace(/{{>\s*footer\s*}}/g, () => footer),
    })),
  );
}
