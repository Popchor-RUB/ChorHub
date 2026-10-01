import { Description, Input, Label, TextField } from '@heroui/react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { MailTemplatePlaceholderHelp } from './MailTemplatePlaceholderHelp';
import { MailTemplateMarkupEditor } from './MailTemplateMarkupEditor';
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
  const htmlEditorId = useId();
  const htmlLabelId = useId();
  const htmlKeyboardHintId = useId();

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

      <div className="flex w-full min-w-0 flex-col gap-2">
        <Label id={htmlLabelId} htmlFor={htmlEditorId}>{t('settings.mail_templates.html_label')}</Label>
        <MailTemplateMarkupEditor
          id={htmlEditorId}
          label={t('settings.mail_templates.html_label')}
          labelId={htmlLabelId}
          descriptionId={htmlKeyboardHintId}
          value={html}
          onChange={onHtmlChange}
          disabled={saving}
          templateKey={templateKey}
        />
        <Description id={htmlKeyboardHintId}>
          {t('settings.mail_templates.html_editor_keyboard_hint')}
        </Description>
      </div>

      <MailTemplatePlaceholderHelp placeholders={placeholders} templateKey={templateKey} />
    </div>
  );
}
