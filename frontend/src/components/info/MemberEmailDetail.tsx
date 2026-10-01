import { useState } from 'react';
import { Button } from '@heroui/react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { MarkdownRenderer } from './MarkdownRenderer';
import { sentEmailsApi } from '../../services/api';
import type { SentEmail } from '../../types';
import { downloadBlob } from '../../utils/downloadBlob';
import { formatEmailDate } from '../../utils/formatEmailDate';
import { formatFileSize } from '../../utils/formatFileSize';

interface MemberEmailDetailProps {
  email: SentEmail;
  onBack: () => void;
}

export function MemberEmailDetail({ email, onBack }: MemberEmailDetailProps) {
  const { t, i18n } = useTranslation();
  const [error, setError] = useState(false);

  const downloadAttachment = async (attachmentId: string, filename: string) => {
    setError(false);
    try {
      const { data } = await sentEmailsApi.downloadMemberAttachment(email.id, attachmentId);
      downloadBlob(data, filename);
    } catch {
      setError(true);
    }
  };

  return (
    <div data-testid="member-email-detail">
      <Button variant="tertiary" className="mb-5" onPress={onBack} data-testid="member-email-back">
        ← {t('common.back')}
      </Button>
      <article className="min-w-0">
        <h2 className="text-lg font-semibold">{email.subject}</h2>
        <p className="mb-5 mt-1 text-sm text-muted">{formatEmailDate(email.sentAt, i18n.language)}</p>
        <MarkdownRenderer content={email.markdownContent} />
        {email.signatureMarkdown && (
          <div className="mt-6 border-t border-border pt-4" data-testid="member-email-signature">
            <MarkdownRenderer content={email.signatureMarkdown} />
          </div>
        )}
        {email.attachments.length > 0 && (
          <section className="mt-6 border-t border-border pt-4">
            <h3 className="mb-2 text-sm font-semibold">{t('info.email_attachments_label')}</h3>
            <ul className="space-y-3">
              {email.attachments.map((attachment) => (
                <li key={attachment.id} className="flex items-start gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium [overflow-wrap:anywhere]">{attachment.filename}</p>
                    <p className="mt-1 text-xs text-muted">{formatFileSize(attachment.size)}</p>
                  </div>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="tertiary"
                    className="shrink-0"
                    aria-label={t('info.email_attachment_download', { filename: attachment.filename })}
                    data-testid="member-email-attachment-link"
                    onPress={() => void downloadAttachment(attachment.id, attachment.filename)}
                  >
                    <ArrowDownTrayIcon className="h-5 w-5" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {error && <p role="alert" className="mt-4 text-danger">{t('info.email_load_error')}</p>}
      </article>
    </div>
  );
}
