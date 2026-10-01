import { Label, ListBox, Select, Spinner } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import type { MailTemplatePreviewScenario } from '../../../types';
import type { PreviewState } from '../../../hooks/useAdminMailTemplates';
import { MailTemplatePreviewFrame } from './MailTemplatePreviewFrame';

interface MailTemplatePreviewPanelProps {
  preview: PreviewState;
  scenarios: MailTemplatePreviewScenario[];
  scenarioId?: string;
  onScenarioChange: (id: string | undefined) => void;
}

export function MailTemplatePreviewPanel({ preview, scenarios, scenarioId, onScenarioChange }: MailTemplatePreviewPanelProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language.startsWith('de') ? 'de' : 'en';

  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="admin-mail-template-preview">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="font-semibold">{t('settings.mail_templates.preview_title')}</h3>
          <p className="mt-1 text-sm text-muted">{t('settings.mail_templates.preview_description')}</p>
        </div>
        {scenarios.length > 0 && (
          <Select
            className="w-full sm:max-w-xs"
            selectedKey={scenarioId}
            onSelectionChange={(key) => onScenarioChange(key === null ? undefined : String(key))}
            aria-label={t('settings.mail_templates.scenario_label')}
            data-testid="admin-mail-template-scenario"
          >
            <Label>{t('settings.mail_templates.scenario_label')}</Label>
            <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
            <Select.Popover>
              <ListBox>
                {scenarios.map((scenario) => (
                  <ListBox.Item key={scenario.id} id={scenario.id} textValue={scenario.name[language]}>
                    {scenario.name[language]}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        )}
      </div>

      {preview.status === 'error' && (
        <p className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground" role="alert">
          {preview.message
            ? t('settings.mail_templates.preview_error_detail', { message: preview.message })
            : t('settings.mail_templates.preview_error')}
        </p>
      )}
      {preview.status === 'loading' && (
        <div className="flex items-center gap-2 text-sm text-muted" role="status">
          <Spinner size="sm" />{t('settings.mail_templates.preview_loading')}
        </div>
      )}
      {preview.status === 'ready' ? (
        <MailTemplatePreviewFrame preview={preview.preview} />
      ) : (
        <div className="h-[68svh] min-h-64 rounded-lg border border-border bg-surface-secondary sm:h-[36rem]" aria-hidden="true" />
      )}
    </div>
  );
}
