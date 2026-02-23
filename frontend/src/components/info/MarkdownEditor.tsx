import { useState, useRef, useEffect } from 'react';
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
  const previewRef = useRef<HTMLDivElement>(null);
  const [textareaHeight, setTextareaHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (previewRef.current) {
      const height = previewRef.current.offsetHeight;
      setTextareaHeight(height);
    }
  }, [value]);

  return (
    <div className="flex flex-col gap-4">
      {/* Mobile: Tab layout */}
      <div className="md:hidden">
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
              maxRows={100}
              classNames={{ input: 'font-mono text-sm' }}
            />
          </Tab>
          <Tab key="preview" title="Vorschau">
            <div className="p-4 border border-default-200 rounded-lg min-h-40">
              <MarkdownRenderer content={value} />
            </div>
          </Tab>
        </Tabs>
      </div>

      {/* Desktop: Side-by-side layout with resizable editor */}
      <div className="hidden md:flex flex-row gap-4 items-start">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="text-sm font-medium text-default-600 mb-2">Bearbeiten</div>
          <Textarea
            placeholder="Markdown eingeben..."
            value={value}
            onValueChange={onChange}
            style={{ height: textareaHeight ? `${textareaHeight}px` : undefined }}
            classNames={{
              input: 'font-mono text-sm resize-y',
            }}
          />
        </div>
        <div className="w-px bg-default-200 flex-shrink-0 self-stretch" />
        <div className="flex-1 flex flex-col min-w-0">
          <div className="text-sm font-medium text-default-600 mb-2">Vorschau</div>
          <div
            ref={previewRef}
            className="p-4 border border-default-200 rounded-lg overflow-auto bg-content1"
          >
            <MarkdownRenderer content={value} />
          </div>
        </div>
      </div>

      <Button color="primary" onPress={onSave} isLoading={saving}>
        Speichern
      </Button>
    </div>
  );
}
