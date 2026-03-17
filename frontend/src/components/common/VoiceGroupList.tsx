import { useState } from 'react';
import type { ReactNode } from 'react';

export interface VoiceGroupData {
  voice: string;
  headerRight: ReactNode;
  rows: { key: string; content: ReactNode }[];
}

interface Props {
  groups: VoiceGroupData[];
  collapsedVoices: Set<string>;
  onToggle: (voice: string) => void;
  /** Optional content rendered at the top of the container (e.g. column headers). */
  header?: ReactNode;
  /** Rendered inside the container when groups is empty. */
  emptyState?: ReactNode;
}

export function VoiceGroupList({ groups, collapsedVoices, onToggle, header, emptyState }: Props) {
  return (
    <div className="rounded-xl border border-divider overflow-hidden">
      {header}
      {groups.length === 0 && emptyState}
      {groups.map(({ voice, headerRight, rows }, groupIdx) => {
        const isCollapsed = collapsedVoices.has(voice);
        const isLastGroup = groupIdx === groups.length - 1;
        return (
          <div key={voice}>
            <button
              className={[
                'w-full flex items-center justify-between px-4 py-2.5',
                'bg-default-100 hover:bg-default-200 transition-colors',
                'text-sm font-semibold text-default-700',
                !isCollapsed || !isLastGroup ? 'border-b border-divider' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onToggle(voice)}
            >
              <span className="flex items-center gap-2">
                <span className="text-default-400">{isCollapsed ? '▸' : '▾'}</span>
                <span>{voice} ({rows.length})</span>
              </span>
              {headerRight}
            </button>
            {!isCollapsed &&
              rows.map(({ key, content }, rowIdx) => (
                <div
                  key={key}
                  className={rowIdx < rows.length - 1 || !isLastGroup ? 'border-b border-divider' : ''}
                >
                  {content}
                </div>
              ))}
          </div>
        );
      })}
    </div>
  );
}

/** Manages collapsed-voices state for use with VoiceGroupList. */
export function useCollapsedVoices() {
  const [collapsedVoices, setCollapsedVoices] = useState<Set<string>>(new Set());

  const toggle = (voice: string) =>
    setCollapsedVoices((prev) => {
      const next = new Set(prev);
      if (next.has(voice)) next.delete(voice);
      else next.add(voice);
      return next;
    });

  const collapseAll = (voices: string[]) => setCollapsedVoices(new Set(voices));

  return { collapsedVoices, toggle, collapseAll };
}
