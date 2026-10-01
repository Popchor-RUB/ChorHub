import { useEffect, useState } from 'react';
import { Button, Spinner } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { MemberEmailDetail } from './MemberEmailDetail';
import { sentEmailsApi } from '../../services/api';
import type { SentEmail } from '../../types';
import { formatEmailDate } from '../../utils/formatEmailDate';

export function MemberEmailArchive() {
  const { t, i18n } = useTranslation();
  const [emails, setEmails] = useState<SentEmail[]>([]);
  const [selected, setSelected] = useState<SentEmail | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    sentEmailsApi.listMember()
      .then(({ data }) => setEmails(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const openEmail = async (email: SentEmail) => {
    setError(false);
    setOpening(true);
    try {
      const { data } = await sentEmailsApi.getMember(email.id);
      setSelected(data);
    } catch {
      setError(true);
    } finally {
      setOpening(false);
    }
  };

  if (loading) return <div className="flex justify-center py-8"><Spinner size="lg" /></div>;
  if (error && !emails.length) return <p role="alert" className="text-danger">{t('info.email_load_error')}</p>;
  if (!emails.length) return <p className="text-muted italic">{t('info.email_archive_empty')}</p>;
  if (opening) return <div className="flex justify-center py-8"><Spinner size="lg" /></div>;
  if (selected) return <MemberEmailDetail email={selected} onBack={() => setSelected(null)} />;

  return (
    <div data-testid="member-email-archive">
      <nav aria-label={t('info.email_archive_label')} className="flex flex-col gap-2 divide-y divide-border">
        {emails.map((email) => (
          <Button
            key={email.id}
            variant="tertiary"
            className="h-auto w-full justify-start whitespace-normal px-3 py-4 text-left"
            data-testid="member-email-subject"
            onPress={() => void openEmail(email)}
          >
            <span className="flex min-w-0 flex-col items-start gap-1">
              <span className="break-words font-medium">{email.subject}</span>
              <span className="text-xs text-muted">{formatEmailDate(email.sentAt, i18n.language)}</span>
            </span>
          </Button>
        ))}
      </nav>
      {error && <p role="alert" className="mt-4 text-danger">{t('info.email_load_error')}</p>}
    </div>
  );
}
