import { hashMailTemplateHtml } from './hash-mail-template';
import { MAIL_TEMPLATE_HASHES } from './mail-template-hashes';
import type { MailTemplateKey } from './mail-template.types';

export interface MailTemplateDefaultHtml {
  key: MailTemplateKey;
  htmlTemplate: string;
}

export interface StoredMailTemplateHtml {
  key: string;
  htmlTemplate: string;
}

export interface MailTemplateHtmlUpdateWhere {
  key: MailTemplateKey;
  htmlTemplate: string;
}

export interface MailTemplateHtmlUpdateData {
  htmlTemplate: string;
}

export type UpdateMailTemplateHtml = (
  where: MailTemplateHtmlUpdateWhere,
  data: MailTemplateHtmlUpdateData,
) => Promise<number>;

/** Update only recognized stock HTML, using original key and HTML as a CAS guard. */
export async function upgradeKnownMailTemplateDefaults(
  defaults: readonly MailTemplateDefaultHtml[],
  storedTemplates: readonly StoredMailTemplateHtml[],
  updateTemplate: UpdateMailTemplateHtml,
  hashes: Readonly<Record<MailTemplateKey, readonly string[]>> = MAIL_TEMPLATE_HASHES,
): Promise<void> {
  const defaultsByKey = new Map(defaults.map((template) => [template.key, template]));

  for (const stored of storedTemplates) {
    if (!isMailTemplateKey(stored.key)) continue;
    const current = defaultsByKey.get(stored.key);
    if (!current || stored.htmlTemplate === current.htmlTemplate) continue;

    const storedHash = hashMailTemplateHtml(stored.htmlTemplate);
    if (!hashes[stored.key].includes(storedHash)) continue;

    await updateTemplate(
      { key: stored.key, htmlTemplate: stored.htmlTemplate },
      { htmlTemplate: current.htmlTemplate },
    );
  }
}

function isMailTemplateKey(key: string): key is MailTemplateKey {
  return Object.prototype.hasOwnProperty.call(MAIL_TEMPLATE_HASHES, key);
}
