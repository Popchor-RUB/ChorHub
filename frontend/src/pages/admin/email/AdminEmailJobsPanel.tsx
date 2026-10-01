import { useState } from 'react';
import { Button, Modal, Spinner } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import type { AdminEmailJob } from '../../../types';
import { formatEmailDate } from '../../../utils/formatEmailDate';

type Props = {
  jobs: AdminEmailJob[];
  loading: boolean;
  connectionError: boolean;
  retry: (job: AdminEmailJob, acknowledgeDuplicateRisk: boolean) => Promise<void>;
};

export function AdminEmailJobsPanel({ jobs, loading, connectionError, retry }: Props) {
  const { t, i18n } = useTranslation();
  const [confirmJob, setConfirmJob] = useState<AdminEmailJob | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryError, setRetryError] = useState(false);
  const [retriedJobIds, setRetriedJobIds] = useState<Set<string>>(() => new Set());

  const startRetry = async (job: AdminEmailJob, acknowledgeDuplicateRisk: boolean) => {
    setRetryingId(job.id);
    setRetryError(false);
    try {
      await retry(job, acknowledgeDuplicateRisk);
      setRetriedJobIds((current) => new Set(current).add(job.id));
      setConfirmJob(null);
    } catch {
      setRetryError(true);
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <section className="flex flex-col gap-3" data-testid="admin-email-jobs" aria-label={t('info.email_jobs_title')}>
      <h2 className="text-lg font-semibold">{t('info.email_jobs_title')}</h2>
      {connectionError && <p className="text-sm text-warning" role="status">{t('info.email_jobs_connection_error')}</p>}
      {loading && jobs.length === 0 ? <Spinner size="sm" /> : null}
      {!loading && jobs.length === 0 && <p className="text-sm text-muted">{t('info.email_jobs_empty')}</p>}
      <ul className="flex flex-col gap-2">
        {jobs.map((job) => (
          <li key={job.id} className="rounded-lg border border-border p-3">
            <details>
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{job.rawSubject || t('info.email_job_subject_fallback')}</span>
                <span data-testid="admin-email-job-status" data-status={job.status} className="text-sm text-muted">
                  {t(`info.email_job_status_${job.status.toLowerCase()}`)}
                </span>
              </summary>
              <div className="mt-3 flex flex-col gap-2 text-sm">
                <p>{t('info.email_job_kind')}: {t(job.kind === 'TEST' ? 'info.email_job_kind_test' : 'info.email_job_kind_bulk')}</p>
                <p>{t('info.email_job_created', { date: formatEmailDate(job.createdAt, i18n.language) })}</p>
                {job.sentAt && <p>{t('info.email_sent_at', { date: formatEmailDate(job.sentAt, i18n.language) })}</p>}
                {job.failureCode && <p className="text-danger">{t('info.email_job_failure', { code: job.failureCode })}</p>}
                {job.retryJobId && <p role="status">{t('info.email_job_replacement_created')}</p>}
                {job.markdownContent && <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-surface-secondary p-2">{job.markdownContent}</pre>}
                {job.attachments.length > 0 && (
                  <ul aria-label={t('info.email_attachments_label')}>
                    {job.attachments.map((attachment) => <li key={attachment.id}>{attachment.filename} ({attachment.size} B)</li>)}
                  </ul>
                )}
                {(job.status === 'FAILED' || job.status === 'UNKNOWN') && !job.retryJobId && !retriedJobIds.has(job.id) && (
                  <Button
                    className="self-start"
                    size="sm"
                    data-testid="admin-email-job-retry"
                    isDisabled={retryingId === job.id}
                    isPending={retryingId === job.id}
                    onPress={() => job.status === 'UNKNOWN' ? setConfirmJob(job) : void startRetry(job, false)}
                  >
                    {({ isPending }) => <>{isPending && <Spinner color="current" size="sm" />}{t('info.email_job_retry')}</>}
                  </Button>
                )}
                {retryError && <p role="alert" className="text-danger">{t('info.email_job_retry_error')}</p>}
              </div>
            </details>
          </li>
        ))}
      </ul>
      <Modal.Backdrop isOpen={confirmJob !== null} onOpenChange={(open) => { if (!open) setConfirmJob(null); }}>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header><Modal.Heading>{t('info.email_job_unknown_retry_title')}</Modal.Heading></Modal.Header>
            <Modal.Body><p>{t('info.email_job_unknown_retry_warning')}</p></Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onPress={() => setConfirmJob(null)}>{t('info.email_job_cancel')}</Button>
              <Button
                variant="danger"
                data-testid="admin-email-job-confirm-retry"
                isDisabled={retryingId !== null}
                onPress={() => { if (confirmJob) void startRetry(confirmJob, true); }}
              >
                {t('info.email_job_confirm_retry')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </section>
  );
}
