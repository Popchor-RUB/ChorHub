import { Label, ListBox, Select } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import type { MailTemplate, MailTemplateKey } from '../../../types';

interface MailTemplateSelectorProps {
  templates: MailTemplate[];
  selectedKey: MailTemplateKey | null;
  onSelect: (key: MailTemplateKey) => void;
  isDisabled?: boolean;
}

export function MailTemplateSelector({ templates, selectedKey, onSelect, isDisabled }: MailTemplateSelectorProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language.startsWith('de') ? 'de' : 'en';

  return (
    <Select
      className="w-full sm:max-w-xl"
      selectedKey={selectedKey ?? undefined}
      onSelectionChange={(key) => {
        const next = templates.find((item) => item.key === key);
        if (next) onSelect(next.key);
      }}
      isDisabled={isDisabled}
      aria-label={t('settings.mail_templates.select_label')}
      data-testid="admin-mail-template-select"
    >
      <Label>{t('settings.mail_templates.select_label')}</Label>
      <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
      <Select.Popover>
        <ListBox>
          {templates.map((item) => (
            <ListBox.Item key={item.key} id={item.key} textValue={item.name[language]}>
              {item.name[language]}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
