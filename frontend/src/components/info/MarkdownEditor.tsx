import { useDeferredValue, useState } from 'react';
import { Button, Label, Spinner, Tabs, TextArea, TextField } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { MarkdownRenderer } from './MarkdownRenderer';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  saving?: boolean;
  hideSaveButton?: boolean;
  readOnly?: boolean;
  fieldLabel?: string;
  fieldTestId?: string;
}

export function MarkdownEditor({ value, onChange, onSave, saving, hideSaveButton = false, readOnly = false, fieldLabel, fieldTestId }: Props) {
  const [selected, setSelected] = useState<string>('edit');
  const deferredPreviewValue = useDeferredValue(value);
  const { t } = useTranslation();
  const editorLabel = fieldLabel ?? t('info.markdown_edit');

  return (
    <div className="flex flex-col gap-4">
      {/* Mobile: Tab layout */}
      <div className="md:hidden">
        <Tabs
          selectedKey={selected}
          onSelectionChange={(k) => setSelected(k as string)}
        >
          <Tabs.ListContainer>
            <Tabs.List aria-label={t('info.markdown_tabs_aria')}>
              <Tabs.Tab id="edit">{t('info.markdown_edit')}<Tabs.Indicator /></Tabs.Tab>
              <Tabs.Tab id="preview">{t('info.markdown_preview')}<Tabs.Indicator /></Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
          <Tabs.Panel id="edit">
            <TextField className="w-full" value={value} onChange={onChange}>
              <Label className="sr-only">{editorLabel}</Label>
              <TextArea
                readOnly={readOnly}
                aria-label={editorLabel}
                data-testid={fieldTestId ? `${fieldTestId}-mobile` : undefined}
                placeholder={t('info.markdown_placeholder')}
                rows={10}
                className="min-h-64 resize-y font-mono text-sm"
              />
            </TextField>
          </Tabs.Panel>
          <Tabs.Panel id="preview">
            <div className="min-h-40 rounded-xl border border-border bg-surface p-4">
              <MarkdownRenderer content={deferredPreviewValue} />
            </div>
          </Tabs.Panel>
        </Tabs>
      </div>

      {/* Desktop: Side-by-side layout with resizable editor */}
      <div className="hidden md:flex flex-row gap-4 items-start">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="text-sm font-medium text-muted mb-2">{editorLabel}</div>
          <TextField className="w-full" value={value} onChange={onChange}>
            <Label className="sr-only">{editorLabel}</Label>
            <TextArea
              readOnly={readOnly}
              aria-label={editorLabel}
              data-testid={fieldTestId ? `${fieldTestId}-desktop` : undefined}
              placeholder={t('info.markdown_placeholder')}
              rows={12}
              className="min-h-[22rem] resize-y font-mono text-sm"
            />
          </TextField>
        </div>
        <div className="w-px bg-surface-secondary flex-shrink-0 self-stretch" />
        <div className="flex-1 flex flex-col min-w-0">
          <div className="text-sm font-medium text-muted mb-2">{t('info.markdown_preview')}</div>
          <div className="min-h-[22rem] overflow-auto rounded-xl border border-border bg-surface p-4">
            <MarkdownRenderer content={deferredPreviewValue} />
          </div>
        </div>
      </div>

      {!hideSaveButton && (
        <Button onPress={onSave} isPending={saving}>
          {({ isPending }) => <>{isPending && <Spinner color="current" size="sm" />}{t('common.save')}</>}
        </Button>
      )}
    </div>
  );
}
