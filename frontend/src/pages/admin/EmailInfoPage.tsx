import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Input, Label, ListBox, Select, Spinner, TextField } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { MarkdownEditor } from '../../components/info/MarkdownEditor';
import { sentEmailsApi } from '../../services/api';
import type { SentEmail } from '../../types';
import { downloadBlob } from '../../utils/downloadBlob';
import { formatEmailDate } from '../../utils/formatEmailDate';

const MAX_FILES = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_TOTAL_SIZE = 20 * 1024 * 1024;

function formatSize(value: number): string {
  return `${(value / (1024 * 1024)).toFixed(value < 1024 * 1024 ? 2 : 1)} MB`;
}

export function EmailInfoPage() {
  const { t, i18n } = useTranslation();
  const [history, setHistory] = useState<SentEmail[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<SentEmail | null>(null);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [signature, setSignature] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const readOnly = selectedEmail !== null;
  const attachmentSize = useMemo(() => attachments.reduce((sum, file) => sum + file.size, 0), [attachments]);

  const loadHistory = useCallback(async () => {
    try {
      const response = await sentEmailsApi.listAdmin();
      const messages = response.data;
      setHistory(messages);
      setSignature(messages[0]?.signatureMarkdown ?? '');
    } catch {
      setError(t('info.email_load_error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const handleSelect = async (key: string | number | null) => {
    setError('');
    setSuccess(false);
    if (key === 'new' || key === null) {
      setSelectedEmail(null);
      setSubject('');
      setContent('');
      setAttachments([]);
      setSignature(history[0]?.signatureMarkdown ?? signature);
      return;
    }
    try {
      const response = await sentEmailsApi.getAdmin(String(key));
      setSelectedEmail(response.data);
      setSubject(response.data.rawSubject);
      setContent(response.data.markdownContent);
      setSignature(response.data.signatureMarkdown);
      setAttachments([]);
    } catch {
      setError(t('info.email_load_error'));
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = '';
    const nextFiles = [...attachments, ...selectedFiles];
    if (nextFiles.length > MAX_FILES) {
      setError(t('info.email_attachment_limit_count', { count: MAX_FILES }));
      return;
    }
    if (selectedFiles.some((file) => file.size > MAX_FILE_SIZE)) {
      setError(t('info.email_attachment_limit_file', { size: 5 }));
      return;
    }
    if (nextFiles.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_SIZE) {
      setError(t('info.email_attachment_limit_total', { size: 20 }));
      return;
    }
    setError('');
    setAttachments(nextFiles);
  };

  const handleSend = async () => {
    setError('');
    setSuccess(false);
    if (!subject.trim()) {
      setError(t('info.email_subject_required'));
      return;
    }
    if (!content.trim()) {
      setError(t('info.email_content_required'));
      return;
    }
    setSending(true);
    try {
      const response = await sentEmailsApi.send({
        subject: subject.trim(),
        markdownContent: content,
        signatureMarkdown: signature,
        attachments,
      });
      setHistory((messages) => [response.data, ...messages]);
      setSelectedEmail(null);
      setSubject('');
      setContent('');
      setSignature(response.data.signatureMarkdown);
      setAttachments([]);
      setSuccess(true);
    } catch {
      setError(t('info.email_send_error'));
    } finally {
      setSending(false);
    }
  };

  const downloadPreviousAttachment = async (attachmentId: string, filename: string) => {
    if (!selectedEmail) return;
    try {
      const response = await sentEmailsApi.downloadAdminAttachment(selectedEmail.id, attachmentId);
      downloadBlob(response.data, filename);
    } catch {
      setError(t('info.email_attachment_download_error'));
    }
  };

  if (loading) return <div className="flex justify-center pt-16"><Spinner size="lg" /></div>;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6" data-testid="admin-email-composer">
      <header>
        <h1 className="text-2xl font-bold">{t('info.email_title')}</h1>
        <p className="mt-1 text-muted">{t('info.email_description')}</p>
      </header>

      <div className="flex flex-col gap-5">
          <Select
            className="w-full"
            selectedKey={selectedEmail?.id ?? 'new'}
            onSelectionChange={(key) => { void handleSelect(key === null ? null : String(key)); }}
            aria-label={t('info.email_history_label')}
            data-testid="admin-email-history"
          >
            <Label>{t('info.email_history_label')}</Label>
            <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="new" textValue={t('info.email_new')}>{t('info.email_new')}<ListBox.ItemIndicator /></ListBox.Item>
                {history.map((email) => (
                  <ListBox.Item key={email.id} id={email.id} textValue={email.subject}>
                    <span className="block max-w-[32rem] truncate">{email.subject}</span>
                    <span className="ml-2 text-xs text-muted">{formatEmailDate(email.sentAt, i18n.language)}</span>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>

          <TextField className="w-full" value={subject} onChange={setSubject} isReadOnly={readOnly} isRequired>
            <Label>{t('info.email_subject_label')}</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span className="shrink-0 rounded-md bg-surface-secondary px-2 py-1.5 text-sm font-medium" data-testid="admin-email-prefix">[Popchor Mitglieder]</span>
              <Input className="min-w-0 flex-1" data-testid="admin-email-subject" placeholder={t('info.email_subject_placeholder')} />
            </div>
          </TextField>

          <section className="flex flex-col gap-2">
            <MarkdownEditor value={content} onChange={setContent} onSave={() => undefined} hideSaveButton readOnly={readOnly} fieldLabel={t('info.email_content_label')} fieldTestId="admin-email-body" />
          </section>

          <section className="flex flex-col gap-2">
            <MarkdownEditor value={signature} onChange={setSignature} onSave={() => undefined} hideSaveButton readOnly={readOnly} fieldLabel={t('info.email_signature_label')} fieldTestId="admin-email-signature" />
          </section>

          <section className="flex flex-col gap-3">
            <Label>{t('info.email_attachments_label')}</Label>
            {!readOnly && (
              <input
                aria-label={t('info.email_attachments_label')}
                data-testid="admin-email-attachments"
                type="file"
                multiple
                onChange={handleFileChange}
                className="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-surface-secondary file:px-3 file:py-1.5"
              />
            )}
            {attachments.length > 0 && (
              <ul className="space-y-1 text-sm" aria-label={t('info.email_selected_attachments')}>
                {attachments.map((file, index) => (
                  <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3">
                    <span className="truncate">{file.name}</span><span className="text-muted">{formatSize(file.size)}</span>
                    {!readOnly && <Button size="sm" variant="tertiary" onPress={() => setAttachments((current) => current.filter((_, i) => i !== index))}>{t('info.email_remove_attachment')}</Button>}
                  </li>
                ))}
              </ul>
            )}
            {readOnly && selectedEmail?.attachments.length ? (
              <ul className="space-y-2" aria-label={t('info.email_attachments_label')}>
                {selectedEmail.attachments.map((attachment) => (
                  <li key={attachment.id}>
                    <Button
                      variant="tertiary"
                      className="h-auto justify-start whitespace-normal p-0 text-left"
                      data-testid="admin-email-attachment-link"
                      onPress={() => void downloadPreviousAttachment(attachment.id, attachment.filename)}
                    >
                      {attachment.filename} <span className="text-muted">({formatSize(attachment.size)})</span>
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            {!readOnly && <p className="text-xs text-muted">{t('info.email_attachment_limits')}</p>}
          </section>

          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          {success && <p role="status" className="text-sm text-accent">{t('info.email_sent')}</p>}
          {!readOnly && (
            <div className="flex justify-end">
              <Button data-testid="admin-email-send" onPress={() => void handleSend()} isPending={sending}>
                {({ isPending }) => <>{isPending && <Spinner color="current" size="sm" />}{t('info.email_send')}</>}
              </Button>
            </div>
          )}
          {readOnly && selectedEmail && <p className="text-xs text-muted">{t('info.email_sent_at', { date: formatEmailDate(selectedEmail.sentAt, i18n.language) })}</p>}
          {!readOnly && attachmentSize > MAX_TOTAL_SIZE && <p className="text-danger">{t('info.email_attachment_limit_total', { size: 20 })}</p>}
      </div>
    </div>
  );
}
