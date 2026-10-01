import { useState } from 'react';
import { Button, Spinner, Tabs } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { useAdminMailTemplates } from '../../../hooks/useAdminMailTemplates';
import { MailTemplateEditor } from './MailTemplateEditor';
import { MailTemplatePreviewPanel } from './MailTemplatePreviewPanel';
import { MailTemplateSelector } from './MailTemplateSelector';
import { MailTemplateSplitPane } from './MailTemplateSplitPane';

export function AdminMailTemplatesSection() {
  const { t, i18n } = useTranslation();
  const templates = useAdminMailTemplates();
  const [mobilePanel, setMobilePanel] = useState<'editor' | 'preview'>('editor');
  const language = i18n.language.startsWith('de') ? 'de' : 'en';

  return (
    <section className="flex min-w-0 max-w-full flex-col gap-4 overflow-hidden border-t border-border pt-6" data-testid="admin-mail-templates">
      <header>
        <h2 className="text-lg font-semibold">{t('settings.mail_templates.title')}</h2>
        <p className="mt-1 text-sm text-muted">{t('settings.mail_templates.description')}</p>
      </header>

      {templates.loading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : templates.loadError ? (
        <p className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground" role="alert">
          {t('settings.mail_templates.load_error')}
        </p>
      ) : templates.templates.length === 0 ? (
        <p className="text-sm text-muted">{t('settings.mail_templates.empty')}</p>
      ) : templates.template && templates.draft ? (
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <MailTemplateSelector
              templates={templates.templates}
              selectedKey={templates.template.key}
              onSelect={templates.selectTemplate}
              isDisabled={templates.saving}
            />
            <p className="min-w-0 text-sm text-muted sm:max-w-lg sm:text-right">
              {templates.template.description[language]}
            </p>
          </div>

          <Tabs
            className="sm:hidden"
            selectedKey={mobilePanel}
            onSelectionChange={(key) => {
              if (key === 'editor' || key === 'preview') setMobilePanel(key);
            }}
          >
            <Tabs.ListContainer>
              <Tabs.List aria-label={t('settings.mail_templates.mobile_view_label')}>
                <Tabs.Tab id="editor" data-testid="admin-mail-template-mobile-editor">
                  {t('settings.mail_templates.editor_tab')}
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="preview" data-testid="admin-mail-template-mobile-preview">
                  {t('settings.mail_templates.preview_tab')}
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>

          <MailTemplateSplitPane
            separatorLabel={t('settings.mail_templates.splitter_label')}
            left={
              <div className={`${mobilePanel === 'editor' ? '' : 'hidden '}min-w-0 sm:block`}>
                <MailTemplateEditor
                  subject={templates.draft.subjectTemplate}
                  html={templates.draft.htmlTemplate}
                  placeholders={templates.template.placeholders}
                  templateKey={templates.template.key}
                  onSubjectChange={templates.updateSubject}
                  onHtmlChange={templates.updateHtml}
                  saving={templates.saving}
                />
              </div>
            }
            right={
              <div className={`${mobilePanel === 'preview' ? '' : 'hidden '}min-w-0 sm:block`}>
                <MailTemplatePreviewPanel
                  preview={templates.previewState}
                  scenarios={templates.template.previewScenarios}
                  scenarioId={templates.scenarioId}
                  onScenarioChange={templates.setScenarioId}
                />
              </div>
            }
          />

          <div className="flex min-w-0 flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-h-6 text-sm" aria-live="polite">
              {templates.dirty && <span className="text-muted">{t('settings.mail_templates.unsaved')}</span>}
              {templates.saveState.status === 'saved' && <span className="text-accent">{t('settings.mail_templates.saved')}</span>}
              {templates.saveState.status === 'error' && (
                <span className="text-danger" role="alert">
                  {templates.saveState.message
                    ? t('settings.mail_templates.save_error_detail', { message: templates.saveState.message })
                    : t('settings.mail_templates.save_error')}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
              <Button
                className="min-h-11 w-full min-w-0 text-base sm:w-auto"
                variant="tertiary"
                onPress={templates.discard}
                isDisabled={!templates.dirty || templates.saving}
                data-testid="admin-mail-template-discard"
              >
                {t('settings.mail_templates.discard')}
              </Button>
              <Button
                className="min-h-11 w-full min-w-0 text-base sm:w-auto"
                onPress={() => { void templates.save(); }}
                isDisabled={!templates.dirty || templates.saving}
                isPending={templates.saving}
                data-testid="admin-mail-template-save"
              >
                {({ isPending }) => <>{isPending && <Spinner color="current" size="sm" />}{t('settings.mail_templates.save')}</>}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
