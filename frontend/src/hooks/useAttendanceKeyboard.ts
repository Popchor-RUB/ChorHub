import { useEffect, useState } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import type { AttendanceRecord } from '../types';

interface Options {
  recordsRef: MutableRefObject<AttendanceRecord[]>;
  visibleMembersRef: MutableRefObject<AttendanceRecord[]>;
  focusedMemberIdRef: MutableRefObject<string | null>;
  toggleAttendanceRef: MutableRefObject<(id: string, attended: boolean) => void>;
  searchInputRef: RefObject<HTMLInputElement | null>;
  rowRefs: MutableRefObject<Map<string, HTMLDivElement>>;
  setFocusedMemberId: (id: string) => void;
}

export function useAttendanceKeyboard({
  recordsRef,
  visibleMembersRef,
  focusedMemberIdRef,
  toggleAttendanceRef,
  searchInputRef,
  rowRefs,
  setFocusedMemberId,
}: Options): { ctrlHeld: boolean } {
  const [ctrlHeld, setCtrlHeld] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      if (e.key === 'Control') {
        setCtrlHeld(true);
        return;
      }

      if (e.key === '/' && !isInInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key === 'Escape' && isInInput) {
        (target as HTMLInputElement).blur();
        return;
      }

      if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const member = visibleMembersRef.current[parseInt(e.key) - 1];
        if (member) toggleAttendanceRef.current(member.id, member.attended);
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const vm = visibleMembersRef.current;
        if (vm.length === 0) return;
        const currentIndex = vm.findIndex((m) => m.id === focusedMemberIdRef.current);
        const newIndex =
          e.key === 'ArrowDown'
            ? currentIndex < vm.length - 1
              ? currentIndex + 1
              : 0
            : currentIndex > 0
            ? currentIndex - 1
            : vm.length - 1;
        const newMember = vm[newIndex];
        setFocusedMemberId(newMember.id);
        rowRefs.current.get(newMember.id)?.scrollIntoView({ block: 'nearest' });
        return;
      }

      if ((e.key === ' ' && !isInInput || e.key === 'Enter') && focusedMemberIdRef.current) {
        e.preventDefault();
        const member = recordsRef.current.find((r) => r.id === focusedMemberIdRef.current);
        if (member) toggleAttendanceRef.current(member.id, member.attended);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') setCtrlHeld(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return { ctrlHeld };
}
