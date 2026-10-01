import { createHash } from 'node:crypto';

/** Hash exact UTF-8 template HTML, including expanded footer content. */
export function hashMailTemplateHtml(htmlTemplate: string): string {
  return createHash('sha256').update(htmlTemplate, 'utf8').digest('hex');
}
