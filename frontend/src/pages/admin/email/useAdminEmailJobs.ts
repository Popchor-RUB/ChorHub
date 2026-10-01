import { useCallback, useEffect, useRef, useState } from 'react';
import { sentEmailsApi } from '../../../services/api';
import type { AdminEmailJob, AdminEmailJobAcceptance } from '../../../types';

const ACTIVE_STATUSES = new Set(['PENDING', 'SENDING']);

export function useAdminEmailJobs(watchedIdempotencyKey: string | null = null) {
  const [jobs, setJobs] = useState<AdminEmailJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  const mounted = useRef(false);
  const inFlight = useRef<Promise<AdminEmailJob[] | null> | null>(null);

  const refresh = useCallback((): Promise<AdminEmailJob[] | null> => {
    if (inFlight.current) return inFlight.current;
    const request = (async () => {
      try {
        const response = await sentEmailsApi.listJobs();
        if (mounted.current) {
          setJobs(response.data);
          setConnectionError(false);
        }
        return response.data;
      } catch {
        if (mounted.current) setConnectionError(true);
        return null;
      } finally {
        if (mounted.current) setLoading(false);
        inFlight.current = null;
      }
    })();
    inFlight.current = request;
    return request;
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const hasActiveJobs = jobs.some((job) => ACTIVE_STATUSES.has(job.status));
  const watchedJobExists = watchedIdempotencyKey !== null
    && jobs.some((job) => job.idempotencyKey === watchedIdempotencyKey);
  const watchingUnresolvedSubmission = watchedIdempotencyKey !== null && !watchedJobExists;
  useEffect(() => {
    if (!connectionError && !hasActiveJobs && !watchingUnresolvedSubmission) return undefined;
    let cancelled = false;
    let timer: number;
    const scheduleNextPoll = () => {
      timer = window.setTimeout(() => {
        void refresh().finally(() => { if (!cancelled) scheduleNextPoll(); });
      }, 2000);
    };
    scheduleNextPoll();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [connectionError, hasActiveJobs, refresh, watchingUnresolvedSubmission]);

  const accept = useCallback((accepted: AdminEmailJobAcceptance, idempotencyKey: string) => {
    setJobs((current) => {
      const previous = current.find((job) => job.id === accepted.id);
      const updated = previous
        ? { ...previous, ...accepted, idempotencyKey }
        : { ...accepted, idempotencyKey, sentAt: null, rawSubject: '', subject: '', markdownContent: '', signatureMarkdown: '', attachments: [], failureCode: null, retryJobId: null };
      return [updated, ...current.filter((job) => job.id !== accepted.id)];
    });
    void (async () => {
      if (inFlight.current) await inFlight.current;
      await refresh();
    })();
  }, [refresh]);

  const retry = useCallback(async (job: AdminEmailJob, idempotencyKey: string, acknowledgeDuplicateRisk: boolean) => {
    const response = await sentEmailsApi.retryJob(job.id, idempotencyKey, acknowledgeDuplicateRisk);
    accept(response.data, idempotencyKey);
    return response.data;
  }, [accept]);

  return { jobs, loading, connectionError, refresh, accept, retry };
}
