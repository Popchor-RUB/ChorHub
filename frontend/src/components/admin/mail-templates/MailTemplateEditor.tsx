import { Input, Label, TextArea, TextField } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { MailTemplatePlaceholderHelp } from './MailTemplatePlaceholderHelp';
import type { MailTemplateKey, MailTemplatePlaceholder } from '../../../types';

interface MailTemplateEditorProps {
  subject: string;
  html: string;
  placeholders: MailTemplatePlaceholder[];
  templateKey: MailTemplateKey;
  onSubjectChange: (value: string) => void;
  onHtmlChange: (value: string) => void;
  saving?: boolean;
}

export function MailTemplateEditor({ subject, html, placeholders, templateKey, onSubjectChange, onHtmlChange, saving = false }: MailTemplateEditorProps) {
  const { t } = useTranslation();

  return (
    <div className="flex min-w-0 flex-col gap-5" data-testid="admin-mail-template-editor">
      <TextField className="w-full" value={subject} onChange={onSubjectChange} isDisabled={saving}>
        <Label>{t('settings.mail_templates.subject_label')}</Label>
        <Input
          aria-label={t('settings.mail_templates.subject_label')}
          autoComplete="off"
          className="text-base"
          data-testid="admin-mail-template-subject"
        />
      </TextField>

      <TextField className="w-full" value={html} onChange={onHtmlChange}>
        <Label>{t('settings.mail_templates.html_label')}</Label>
        <TextArea
          aria-label={t('settings.mail_templates.html_label')}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          className="min-h-[58svh] resize-y font-mono text-base leading-6 sm:min-h-[34rem] sm:text-sm"
          data-testid="admin-mail-template-html"
          disabled={saving}
          spellCheck={false}
          wrap="off"
        />
      </TextField>

      <MailTemplatePlaceholderHelp placeholders={placeholders} templateKey={templateKey} />
    </div>
  );
}
