import axios from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Label, ListBox, Select, Spinner, TextField } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { MarkdownEditor } from '../../components/info/MarkdownEditor';
import { sentEmailsApi } from '../../services/api';
import type { SentEmail } from '../../types';
import { downloadBlob } from '../../utils/downloadBlob';
import { formatEmailDate } from '../../utils/formatEmailDate';
import { formatFileSize } from '../../utils/formatFileSize';
import { AdminEmailJobsPanel } from './email/AdminEmailJobsPanel';
import { useAdminEmailJobs } from './email/useAdminEmailJobs';
import { clearEmailRetryKey, clearEmailSubmission, getEmailPayloadFingerprint, getEmailRetryKey, getEmailSubmissionKey, saveAcceptedEmailJob } from './email/emailSubmissionKey';
import type { AdminEmailJob, AdminEmailJobKind } from '../../types';

const MAX_FILES = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_TOTAL_SIZE = 20 * 1024 * 1024;

export function EmailInfoPage() {
  const { t, i18n } = useTranslation();
  const [history, setHistory] = useState<SentEmail[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<SentEmail | null>(null);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [signature, setSignature] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<'test' | 'all' | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<'test' | 'all' | null>(null);
  const [submissionKey, setSubmissionKey] = useState<{ kind: AdminEmailJobKind; key: string } | null>(null);
  const [submissionFingerprint, setSubmissionFingerprint] = useState<string | null>(null);
  const clearedJobRef = useRef<string | null>(null);
  const emailJobs = useAdminEmailJobs(submissionKey?.key ?? null);

  const readOnly = selectedEmail !== null;
  const attachmentSize = useMemo(() => attachments.reduce((sum, file) => sum + file.size, 0), [attachments]);

  const loadHistory = useCallback(async (preserveSignature = false) => {
    try {
      const response = await sentEmailsApi.listAdmin();
      const messages = response.data;
      setHistory(messages);
      if (!preserveSignature) setSignature(messages[0]?.signatureMarkdown ?? '');
    } catch {
      setError(t('info.email_load_error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const linkedJob = submissionKey ? emailJobs.jobs.find((job) => job.idempotencyKey === submissionKey.key) ?? null : null;

  useEffect(() => {
    if (!linkedJob || linkedJob.status !== 'SENT' || clearedJobRef.current === linkedJob.id) return;
    clearedJobRef.current = linkedJob.id;
    if (submissionFingerprint) clearEmailSubmission(linkedJob.kind, submissionFingerprint);
    setSubmissionKey(null);
    if (linkedJob.kind === 'TEST') {
      setSuccess('test');
      return;
    }
    setSelectedEmail(null);
    setSubject('');
    setContent('');
    setAttachments([]);
    setSignature(linkedJob.signatureMarkdown);
    void loadHistory(true);
    setSubmissionKey(null);
    setSuccess('all');
  }, [linkedJob, loadHistory, submissionFingerprint]);

  const handleSelect = async (key: string | number | null) => {
    setError('');
    setSuccess(null);
    setSubmissionKey(null);
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
    setSubmissionKey(null);
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

  const handleSend = async (testOnly: boolean) => {
    if (sending) return;
    setError('');
    setSuccess(null);
    if (!subject.trim()) {
      setError(t('info.email_subject_required'));
      return;
    }
    if (!content.trim()) {
      setError(t('info.email_content_required'));
      return;
    }
    setSending(testOnly ? 'test' : 'all');
    try {
      const input = {
        subject: subject.trim(),
        markdownContent: content,
        signatureMarkdown: signature,
        attachments,
      };
      const kind: AdminEmailJobKind = testOnly ? 'TEST' : 'BULK';
      const fingerprint = await getEmailPayloadFingerprint(input);
      setSubmissionFingerprint(fingerprint);
      const submission = getEmailSubmissionKey(kind, fingerprint);
      setSubmissionKey({ kind, key: submission.key });
      const existingJob = emailJobs.jobs.find((job) => job.idempotencyKey === submission.key);
      if (existingJob) {
        saveAcceptedEmailJob(kind, submission, existingJob.id);
        emailJobs.accept({ id: existingJob.id, kind: existingJob.kind, status: existingJob.status, createdAt: existingJob.createdAt }, submission.key);
        await emailJobs.refresh();
        return;
      }
      if (testOnly) {
        const response = await sentEmailsApi.sendTest(input, submission.key);
        saveAcceptedEmailJob(kind, submission, response.data.id);
        emailJobs.accept(response.data, submission.key);
      } else {
        const response = await sentEmailsApi.send(input, submission.key);
        saveAcceptedEmailJob(kind, submission, response.data.id);
        emailJobs.accept(response.data, submission.key);
      }
      setSuccess(null);
    } catch (sendError) {
      if (axios.isAxiosError(sendError) && sendError.response?.status === 409) {
        setError(t('info.email_submission_conflict'));
      } else if (axios.isAxiosError(sendError) && sendError.response && sendError.response.status < 500) {
        setError(t('info.email_submission_failed'));
      } else {
        setError(t('info.email_submission_uncertain'));
        void emailJobs.refresh();
      }
    } finally {
      setSending(null);
    }
  };

  const handleRetryJob = async (job: AdminEmailJob, acknowledgeDuplicateRisk: boolean) => {
    const key = getEmailRetryKey(job.id);
    await emailJobs.retry(job, key, acknowledgeDuplicateRisk);
    clearEmailRetryKey(job.id);
  };

  const acceptedForComposer = linkedJob !== null;

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
            <Input className="min-w-0 text-base" data-testid="admin-email-subject" placeholder={t('info.email_subject_placeholder')} onChange={(event) => { setSubject(event.target.value); setSubmissionKey(null); setSuccess(null); }} />
          </TextField>
          <p className="-mt-3 text-sm text-muted" data-testid="admin-email-template-hint">
            {t('info.email_template_hint')}
          </p>

          <section className="flex flex-col gap-2">
            <MarkdownEditor value={content} onChange={(value) => { setContent(value); setSubmissionKey(null); setSuccess(null); }} onSave={() => undefined} hideSaveButton readOnly={readOnly} fieldLabel={t('info.email_content_label')} fieldTestId="admin-email-body" />
          </section>

          <section className="flex flex-col gap-2">
            <MarkdownEditor value={signature} onChange={(value) => { setSignature(value); setSubmissionKey(null); setSuccess(null); }} onSave={() => undefined} hideSaveButton readOnly={readOnly} fieldLabel={t('info.email_signature_label')} fieldTestId="admin-email-signature" />
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
                    <span className="truncate">{file.name}</span><span className="text-muted">{formatFileSize(file.size)}</span>
                    {!readOnly && <Button size="sm" variant="tertiary" onPress={() => { setAttachments((current) => current.filter((_, i) => i !== index)); setSubmissionKey(null); setSuccess(null); }}>{t('info.email_remove_attachment')}</Button>}
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
                      {attachment.filename} <span className="text-muted">({formatFileSize(attachment.size)})</span>
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            {!readOnly && <p className="text-xs text-muted">{t('info.email_attachment_limits')}</p>}
          </section>

          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          {success && <p role="status" className="text-sm text-accent">{t(success === 'test' ? 'info.email_test_sent' : 'info.email_sent')}</p>}
          {linkedJob && linkedJob.status !== 'SENT' && <p role="status" className="text-sm text-muted">{t(`info.email_job_status_${linkedJob.status.toLowerCase()}`)}</p>}
          {!readOnly && (
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" data-testid="admin-email-send-test" onPress={() => void handleSend(true)} isDisabled={sending !== null || (acceptedForComposer && submissionKey?.kind === 'TEST')} isPending={sending === 'test'}>
                {({ isPending }) => <>{isPending && <Spinner color="current" size="sm" />}{t('info.email_send_test')}</>}
              </Button>
              <Button data-testid="admin-email-send" onPress={() => void handleSend(false)} isDisabled={sending !== null || (acceptedForComposer && submissionKey?.kind === 'BULK')} isPending={sending === 'all'}>
                {({ isPending }) => <>{isPending && <Spinner color="current" size="sm" />}{t('info.email_send')}</>}
              </Button>
            </div>
          )}
          {readOnly && selectedEmail && <p className="text-xs text-muted">{t('info.email_sent_at', { date: formatEmailDate(selectedEmail.sentAt, i18n.language) })}</p>}
          {!readOnly && attachmentSize > MAX_TOTAL_SIZE && <p className="text-danger">{t('info.email_attachment_limit_total', { size: 20 })}</p>}
      </div>
      <AdminEmailJobsPanel jobs={emailJobs.jobs} loading={emailJobs.loading} connectionError={emailJobs.connectionError} retry={handleRetryJob} />
    </div>
  );
}
