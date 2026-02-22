import { useState } from 'react';
import { Tabs, Tab, Textarea, Button } from '@heroui/react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  saving?: boolean;
}

export function MarkdownEditor({ value, onChange, onSave, saving }: Props) {
  const [selected, setSelected] = useState<string>('edit');

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        selectedKey={selected}
        onSelectionChange={(k) => setSelected(k as string)}
        aria-label="Markdown Editor Tabs"
      >
        <Tab key="edit" title="Bearbeiten">
          <Textarea
            placeholder="Markdown eingeben..."
            value={value}
            onValueChange={onChange}
            minRows={10}
            classNames={{ input: 'font-mono text-sm' }}
          />
        </Tab>
        <Tab key="preview" title="Vorschau">
          <div className="p-4 border border-default-200 rounded-lg min-h-40">
            <MarkdownRenderer content={value} />
          </div>
        </Tab>
      </Tabs>
      <Button color="primary" onPress={onSave} isLoading={saving}>
        Speichern
      </Button>
    </div>
  );
}
