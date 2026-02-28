import { useEffect, useRef, useState } from 'react';
import {
  Select,
  SelectItem,
  SelectSection,
  Input,
  Button,
  Chip,
  Spinner,
} from '@heroui/react';
import { rehearsalsApi, attendanceApi } from '../../services/api';
import type { Rehearsal, AttendanceRecord, ChoirVoice } from '../../types';
import { CHOIR_VOICE_LABELS } from '../../types';

const VOICE_ORDER: ChoirVoice[] = ['SOPRAN', 'MEZZOSOPRAN', 'ALT', 'TENOR', 'BARITON', 'BASS'];

const formatDate = (d: string) =>
  new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(d));

const formatDateShort = (d: string) =>
  new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(d));

function formatLastAttended(ago: number | null): string {
  if (ago === null) return 'Noch nie';
  if (ago === 1) return 'Letzte Probe';
  return `Vor ${ago} Proben`;
}

export function AttendancePage() {
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [selectedRehearsalId, setSelectedRehearsalId] = useState('');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  const [nameFilter, setNameFilter] = useState('');
  const [voiceFilter, setVoiceFilter] = useState<ChoirVoice | null>(null);
  const [collapsedVoices, setCollapsedVoices] = useState<Set<ChoirVoice>>(new Set());

  const [saving, setSaving] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [focusedMemberId, setFocusedMemberId] = useState<string | null>(null);
  const [ctrlHeld, setCtrlHeld] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Stable refs to avoid stale closures in keyboard handler
  const recordsRef = useRef(records);
  recordsRef.current = records;
  const selectedRehearsalIdRef = useRef(selectedRehearsalId);
  selectedRehearsalIdRef.current = selectedRehearsalId;
  const savingRef = useRef(saving);
  savingRef.current = saving;

  useEffect(() => {
    rehearsalsApi.getAll().then((res) => setRehearsals(res.data as Rehearsal[]));
  }, []);

  useEffect(() => {
    if (!selectedRehearsalId) {
      setRecords([]);
      return;
    }
    setLoadingRecords(true);
    setNameFilter('');
    setVoiceFilter(null);
    setCollapsedVoices(new Set());
    setFocusedMemberId(null);
    attendanceApi.getRecords(selectedRehearsalId).then((res) => {
      setRecords(res.data as AttendanceRecord[]);
      setLoadingRecords(false);
    });
  }, [selectedRehearsalId]);

  // Poll for remote changes every 5 s so multiple admins stay in sync
  useEffect(() => {
    if (!selectedRehearsalId) return;
    const interval = setInterval(() => {
      if (savingRef.current) return;
      attendanceApi.getRecords(selectedRehearsalId).then((res) => {
        if (!savingRef.current) setRecords(res.data as AttendanceRecord[]);
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedRehearsalId]);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const pastRehearsals = rehearsals
    .filter((r) => new Date(r.date) < startOfToday)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const futureRehearsals = rehearsals
    .filter((r) => new Date(r.date) >= startOfToday)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const selectedRehearsal = rehearsals.find((r) => r.id === selectedRehearsalId);
  const attendedCount = records.filter((r) => r.attended).length;

  const filteredRecords = records.filter((r) => {
    const q = nameFilter.toLowerCase();
    const matchesName =
      !q ||
      `${r.lastName} ${r.firstName}`.toLowerCase().includes(q) ||
      `${r.firstName} ${r.lastName}`.toLowerCase().includes(q);
    return matchesName && (!voiceFilter || r.choirVoice === voiceFilter);
  });

  const groups = VOICE_ORDER.map((voice) => ({
    voice,
    members: filteredRecords.filter((r) => r.choirVoice === voice),
  })).filter((g) => g.members.length > 0);

  const visibleMembers = groups
    .filter((g) => !collapsedVoices.has(g.voice))
    .flatMap((g) => g.members);

  const visibleMembersRef = useRef(visibleMembers);
  visibleMembersRef.current = visibleMembers;
  const focusedMemberIdRef = useRef(focusedMemberId);
  focusedMemberIdRef.current = focusedMemberId;

  const toggleAttendance = async (memberId: string, currentlyAttended: boolean) => {
    if (saving) return;
    setSaving(memberId);
    setSaveError(null);

    const newAttendedIds = currentlyAttended
      ? recordsRef.current.filter((r) => r.attended && r.id !== memberId).map((r) => r.id)
      : [...recordsRef.current.filter((r) => r.attended).map((r) => r.id), memberId];

    setRecords((prev) =>
      prev.map((r) => (r.id === memberId ? { ...r, attended: !currentlyAttended } : r)),
    );

    try {
      await attendanceApi.bulkSetRecords(selectedRehearsalIdRef.current, newAttendedIds);
    } catch {
      setRecords((prev) =>
        prev.map((r) => (r.id === memberId ? { ...r, attended: currentlyAttended } : r)),
      );
      setSaveError('Speichern fehlgeschlagen');
    } finally {
      setSaving(null);
    }
  };

  const toggleAttendanceRef = useRef(toggleAttendance);
  toggleAttendanceRef.current = toggleAttendance;

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

      // Ctrl+1–9: toggle attendance for the Nth visible member
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

  const toggleVoiceCollapse = (voice: ChoirVoice) => {
    setCollapsedVoices((prev) => {
      const next = new Set(prev);
      if (next.has(voice)) next.delete(voice);
      else next.add(voice);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <h1 className="text-2xl font-bold">Anwesenheit erfassen</h1>

      {/* Rehearsal selector */}
      <div className="flex flex-col gap-2">
        <Select
          label="Probe"
          placeholder="Probe auswählen..."
          selectedKeys={selectedRehearsalId ? [selectedRehearsalId] : []}
          onSelectionChange={(keys) => {
            const id = Array.from(keys)[0] as string;
            setSelectedRehearsalId(id ?? '');
          }}
        >
          <SelectSection showDivider title="Kommende Proben">
            {futureRehearsals.map((r) => (
              <SelectItem key={r.id} textValue={`${formatDateShort(r.date)} – ${r.title}`}>
                {formatDateShort(r.date)} – {r.title}
              </SelectItem>
            ))}
          </SelectSection>
          <SelectSection title="Vergangene Proben">
            {pastRehearsals.map((r) => (
              <SelectItem key={r.id} textValue={`${formatDateShort(r.date)} – ${r.title}`}>
                {formatDateShort(r.date)} – {r.title}
              </SelectItem>
            ))}
          </SelectSection>
        </Select>

        {selectedRehearsal && !loadingRecords && (
          <p className="text-sm text-default-500 px-1">
            {formatDate(selectedRehearsal.date)} ·{' '}
            <span className="font-medium text-success-600">{attendedCount}</span> von{' '}
            {records.length} anwesend
          </p>
        )}
        {loadingRecords && <Spinner size="sm" />}
      </div>

      {/* Roll call table */}
      {selectedRehearsalId && !loadingRecords && (
        <>
          {/* Filters */}
          <div className="flex flex-col gap-2">
            <Input
              ref={searchInputRef}
              placeholder="Name filtern…"
              value={nameFilter}
              onValueChange={setNameFilter}
              onClear={() => setNameFilter('')}
              isClearable
              size="sm"
            />
            <div className="flex flex-wrap gap-1.5">
              <Chip
                size="sm"
                variant={!voiceFilter ? 'solid' : 'flat'}
                color={!voiceFilter ? 'primary' : 'default'}
                className="cursor-pointer select-none"
                onClick={() => setVoiceFilter(null)}
              >
                Alle
              </Chip>
              {VOICE_ORDER.map((voice) => (
                <Chip
                  key={voice}
                  size="sm"
                  variant={voiceFilter === voice ? 'solid' : 'flat'}
                  color={voiceFilter === voice ? 'primary' : 'default'}
                  className="cursor-pointer select-none"
                  onClick={() => setVoiceFilter((prev) => (prev === voice ? null : voice))}
                >
                  {CHOIR_VOICE_LABELS[voice]}
                </Chip>
              ))}
            </div>
          </div>

          {saveError && (
            <p className="text-sm text-danger text-center">{saveError}</p>
          )}

          {/* Member table */}
          <div className="rounded-xl border border-divider overflow-hidden">
            {/* Column headers — desktop only */}
            <div className="hidden sm:grid sm:grid-cols-[1fr_160px_110px] px-4 py-2 bg-default-50 border-b border-divider text-xs font-semibold text-default-500 uppercase tracking-wide">
              <span>Name</span>
              <span>Letzte Probe</span>
              <span className="text-right">Anwesenheit</span>
            </div>

            {groups.length === 0 && (
              <p className="text-center text-default-400 py-10 text-sm">
                Keine Mitglieder gefunden
              </p>
            )}

            {groups.map((group) => {
              const isCollapsed = collapsedVoices.has(group.voice);
              const groupAttended = group.members.filter((m) => m.attended).length;
              return (
                <div key={group.voice}>
                  {/* Section header */}
                  <button
                    className="w-full flex items-center justify-between px-4 py-2 bg-default-100 hover:bg-default-200 transition-colors border-b border-divider text-sm font-semibold text-default-700"
                    onClick={() => toggleVoiceCollapse(group.voice)}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-default-400">{isCollapsed ? '▸' : '▾'}</span>
                      <span>{CHOIR_VOICE_LABELS[group.voice]}</span>
                    </span>
                    <span className="text-xs font-normal text-default-500">
                      {groupAttended} / {group.members.length} anwesend
                    </span>
                  </button>

                  {/* Member rows */}
                  {!isCollapsed &&
                    group.members.map((member, idx) => {
                      const isLast = idx === group.members.length - 1;
                      const isFocused = focusedMemberId === member.id;
                      const isSaving = saving === member.id;
                      const visibleIdx = visibleMembers.findIndex((m) => m.id === member.id);
                      const shortcutNum = ctrlHeld && visibleIdx >= 0 && visibleIdx < 9 ? visibleIdx + 1 : null;
                      return (
                        <div
                          key={member.id}
                          ref={(el) => {
                            if (el) rowRefs.current.set(member.id, el);
                            else rowRefs.current.delete(member.id);
                          }}
                          className={[
                            'grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_160px_110px] items-center px-4 py-3 transition-colors',
                            !isLast ? 'border-b border-divider' : '',
                            member.attended ? 'bg-success-50 dark:bg-success-900/20' : 'bg-content1',
                            isFocused ? 'ring-2 ring-inset ring-primary' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          onClick={() => setFocusedMemberId(member.id)}
                        >
                          {/* Name + secondary line on mobile */}
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">
                              {member.lastName}, {member.firstName}
                            </p>
                            <p className="text-xs text-default-400 sm:hidden mt-0.5">
                              {formatLastAttended(member.lastAttendedRehearsalsAgo)}
                            </p>
                          </div>

                          {/* Last attended — desktop only */}
                          <p className="hidden sm:block text-sm text-default-500">
                            {formatLastAttended(member.lastAttendedRehearsalsAgo)}
                          </p>

                          {/* Toggle button */}
                          <div className="flex justify-end items-center gap-1.5">
                            {shortcutNum !== null && (
                              <span className="hidden sm:block text-xs font-mono text-default-400 w-4 text-center">
                                {shortcutNum}
                              </span>
                            )}
                            <Button
                              size="sm"
                              color={member.attended ? 'success' : 'default'}
                              variant={member.attended ? 'solid' : 'bordered'}
                              isLoading={isSaving}
                              onPress={() => toggleAttendance(member.id, member.attended)}
                              className="min-w-[90px]"
                            >
                              {member.attended ? '✓ Anwesend' : '+ Erfassen'}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>

          {/* Keyboard shortcut hint — desktop only */}
          <p className="hidden sm:block text-xs text-default-400 text-center">
            ↑↓ navigieren · Leertaste/Enter umschalten · / suchen · Strg+1–9 erfassen
          </p>
        </>
      )}
    </div>
  );
}
