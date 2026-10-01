import { useTranslation } from 'react-i18next';
import type { MailTemplateKey, MailTemplatePlaceholder } from '../../../types';

interface MailTemplatePlaceholderHelpProps {
  placeholders: MailTemplatePlaceholder[];
  templateKey: MailTemplateKey;
}

export function MailTemplatePlaceholderHelp({ placeholders, templateKey }: MailTemplatePlaceholderHelpProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language.startsWith('de') ? 'de' : 'en';
  const hasHtmlSignature = placeholders.some((placeholder) => placeholder.name === 'htmlSignature');

  return (
    <aside className="min-w-0 border-t border-border pt-4" data-testid="admin-mail-template-placeholders">
      <h3 className="font-semibold">{t('settings.mail_templates.placeholders_title')}</h3>
      <div className="mt-1 space-y-1 text-sm text-muted">
        <p>
          {t('settings.mail_templates.placeholder_syntax_escaped')}{' '}
          <code className="rounded bg-surface-secondary px-1">{'{{name}}'}</code>.
        </p>
        <p>
          {t('settings.mail_templates.placeholder_syntax_raw')}{' '}
          <code className="rounded bg-surface-secondary px-1">{'{{{htmlContent}}}'}</code>.
        </p>
        {templateKey === 'push-fallback-reminder' && (
          <p>
            {t('settings.mail_templates.loop_example')}{' '}
            <code className="break-all rounded bg-surface-secondary px-1">{'{{#each items}}{{label}}{{/each}}'}</code>
          </p>
        )}
        {hasHtmlSignature && (
          <p>
            {t('settings.mail_templates.conditional_example')}{' '}
            <code className="break-all rounded bg-surface-secondary px-1">{'{{#if htmlSignature}}…{{/if}}'}</code>
          </p>
        )}
      </div>
      {placeholders.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{t('settings.mail_templates.no_placeholders')}</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {placeholders.map((placeholder) => (
            <li key={placeholder.name} className="grid min-w-0 gap-1 py-3 sm:grid-cols-[minmax(8rem,0.8fr)_minmax(0,1.4fr)] sm:gap-4">
              <div className="min-w-0">
                <code className="break-all rounded bg-surface-secondary px-1.5 py-0.5 text-sm">{placeholder.syntax}</code>
                {placeholder.optional && (
                  <span className="ml-2 text-xs text-muted">{t('settings.mail_templates.optional')}</span>
                )}
                {placeholder.scope && (
                  <p className="mt-1 break-words text-xs text-muted">
                    {t('settings.mail_templates.scope', { scope: placeholder.scope })}
                  </p>
                )}
              </div>
              <div className="min-w-0 text-sm">
                <p>{placeholder.description[language]}</p>
                <p className="mt-1 break-words text-muted">
                  {t('settings.mail_templates.example', { value: placeholder.example })}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
