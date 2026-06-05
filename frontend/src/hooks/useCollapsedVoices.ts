import { useCallback, useState } from 'react';

/** Manages collapsed-voices state for use with VoiceGroupList. */
export function useCollapsedVoices() {
  const [collapsedVoices, setCollapsedVoices] = useState<Set<string>>(new Set());

  const toggle = useCallback((voice: string) => {
    setCollapsedVoices((prev) => {
      const next = new Set(prev);
      if (next.has(voice)) next.delete(voice);
      else next.add(voice);
      return next;
    });
  }, []);

  const collapseAll = useCallback((voices: string[]) => {
    setCollapsedVoices(new Set(voices));
  }, []);

  return { collapsedVoices, toggle, collapseAll };
}
