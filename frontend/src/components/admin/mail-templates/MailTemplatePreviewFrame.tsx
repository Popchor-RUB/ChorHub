import { useTranslation } from 'react-i18next';
import type { MailTemplatePreview } from '../../../types';

function makeSandboxDocument(html: string): string {
  const policy = "default-src 'none'; img-src data: https:; style-src 'unsafe-inline'; font-src data:; form-action 'none'; base-uri 'none'";
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"></head><body>${html}</body></html>`;
}

interface MailTemplatePreviewFrameProps {
  preview: MailTemplatePreview;
}

export function MailTemplatePreviewFrame({ preview }: MailTemplatePreviewFrameProps) {
  const { t } = useTranslation();
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-white text-slate-950">
      <div className="border-b border-slate-200 px-3 py-2 text-sm">
        <span className="font-medium">{t('settings.mail_templates.preview_subject')}:</span>{' '}
        <span className="break-words">{preview.subject}</span>
      </div>
      <iframe
        className="block h-[68svh] w-full max-w-full bg-white sm:h-[36rem]"
        data-testid="admin-mail-template-preview-frame"
        referrerPolicy="no-referrer"
        sandbox=""
        srcDoc={makeSandboxDocument(preview.html)}
        title={t('settings.mail_templates.preview_frame_title')}
      />
    </div>
  );
}
