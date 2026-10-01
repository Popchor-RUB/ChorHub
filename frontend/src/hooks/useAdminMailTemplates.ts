import { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { adminMailTemplatesApi } from '../services/api';
import type {
  MailTemplate,
  MailTemplateKey,
  MailTemplatePreview,
} from '../types';

interface MailTemplateDraft {
  subjectTemplate: string;
  htmlTemplate: string;
}

export type PreviewState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; preview: MailTemplatePreview }
  | { status: 'error'; message?: string };

export function useAdminMailTemplates() {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [selectedKey, setSelectedKey] = useState<MailTemplateKey | null>(null);
  const [draft, setDraft] = useState<MailTemplateDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<{ status: 'idle' | 'saved' | 'error'; message?: string }>({ status: 'idle' });
  const [scenarioId, setScenarioId] = useState<string | undefined>();
  const [previewState, setPreviewState] = useState<PreviewState>({ status: 'idle' });
  const previewSequence = useRef(0);

  const template = templates.find((item) => item.key === selectedKey) ?? null;
  const dirty = Boolean(
    template && draft && (
      draft.subjectTemplate !== template.subjectTemplate
      || draft.htmlTemplate !== template.htmlTemplate
    ),
  );

  useEffect(() => {
    let mounted = true;
    adminMailTemplatesApi.list()
      .then(({ data }) => {
        if (!mounted) return;
        setTemplates(data.templates);
        const first = data.templates[0];
        if (first) {
          setSelectedKey(first.key);
          setDraft({ subjectTemplate: first.subjectTemplate, htmlTemplate: first.htmlTemplate });
          setScenarioId(first.previewScenarios[0]?.id);
        }
      })
      .catch(() => { if (mounted) setLoadError(true); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!dirty) return undefined;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [dirty]);

  const blocker = useBlocker(dirty);
  const { state: blockerState, proceed: proceedNavigation, reset: resetNavigation } = blocker;
  useEffect(() => {
    if (blockerState !== 'blocked') return;
    if (!dirty || window.confirm(t('settings.mail_templates.unsaved_navigation'))) {
      proceedNavigation();
    } else {
      resetNavigation();
    }
  }, [blockerState, dirty, proceedNavigation, resetNavigation, t]);

  const selectTemplate = useCallback((key: MailTemplateKey) => {
    if (key === selectedKey) return;
    const next = templates.find((item) => item.key === key);
    if (!next) return;
    if (dirty && !window.confirm(t('settings.mail_templates.unsaved_template_switch'))) return;
    previewSequence.current += 1;
    setSelectedKey(key);
    setDraft({ subjectTemplate: next.subjectTemplate, htmlTemplate: next.htmlTemplate });
    setScenarioId(next.previewScenarios[0]?.id);
    setPreviewState({ status: 'idle' });
    setSaveState({ status: 'idle' });
  }, [dirty, selectedKey, t, templates]);

  const updateSubject = useCallback((subjectTemplate: string) => {
    setDraft((current) => current ? { ...current, subjectTemplate } : current);
    setSaveState({ status: 'idle' });
  }, []);

  const updateHtml = useCallback((htmlTemplate: string) => {
    setDraft((current) => current ? { ...current, htmlTemplate } : current);
    setSaveState({ status: 'idle' });
  }, []);

  const discard = useCallback(() => {
    if (!template) return;
    setDraft({ subjectTemplate: template.subjectTemplate, htmlTemplate: template.htmlTemplate });
    setSaveState({ status: 'idle' });
  }, [template]);

  const save = useCallback(async () => {
    if (!template || !draft || !dirty || saving) return;
    setSaving(true);
    setSaveState({ status: 'idle' });
    try {
      const { data: updated } = await adminMailTemplatesApi.update(template.key, draft);
      setTemplates((current) => current.map((item) => item.key === updated.key ? updated : item));
      if (selectedKey === updated.key) {
        setDraft((current) => current
          && current.subjectTemplate === draft.subjectTemplate
          && current.htmlTemplate === draft.htmlTemplate
          ? { subjectTemplate: updated.subjectTemplate, htmlTemplate: updated.htmlTemplate }
          : current);
      }
      setSaveState({ status: 'saved' });
    } catch (error: unknown) {
      const detail = getApiErrorMessage(error);
      setSaveState({ status: 'error', message: detail });
    } finally {
      setSaving(false);
    }
  }, [dirty, draft, saving, selectedKey, template]);

  useEffect(() => {
    if (!template || !draft) return undefined;
    const sequence = ++previewSequence.current;
    setPreviewState({ status: 'loading' });
    const timer = window.setTimeout(() => {
      adminMailTemplatesApi.preview(template.key, {
        ...draft,
        ...(scenarioId ? { scenarioId } : {}),
      }).then(({ data }) => {
        if (sequence === previewSequence.current) setPreviewState({ status: 'ready', preview: data });
      }).catch((error: unknown) => {
        if (sequence === previewSequence.current) {
          setPreviewState({ status: 'error', message: getApiErrorMessage(error) });
        }
      });
    }, 400);
    return () => {
      window.clearTimeout(timer);
      previewSequence.current += 1;
    };
  }, [draft, scenarioId, template]);

  return {
    templates,
    template,
    draft,
    loading,
    loadError,
    saving,
    saveState,
    dirty,
    scenarioId,
    previewState,
    selectTemplate,
    updateSubject,
    updateHtml,
    setScenarioId,
    discard,
    save,
  };
}

function getApiErrorMessage(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('response' in error)) return undefined;
  const response = error.response;
  if (typeof response !== 'object' || response === null || !('data' in response)) return undefined;
  const data = response.data;
  if (typeof data !== 'object' || data === null) return undefined;
  if ('message' in data && typeof data.message === 'string') return data.message;
  if ('error' in data && typeof data.error === 'object' && data.error !== null
    && 'message' in data.error && typeof data.error.message === 'string') {
    return data.error.message;
  }
  return undefined;
}
