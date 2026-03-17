import { useEffect, useRef, useState } from 'react';
import { Select, SelectItem, SelectSection, Input, Button, Spinner } from '@heroui/react';
import { rehearsalsApi, attendanceApi } from '../../services/api';
import type { Rehearsal, AttendanceRecord } from '../../types';
import { VoiceGroupList, useCollapsedVoices } from '../../components/common/VoiceGroupList';
import type { VoiceGroupData } from '../../components/common/VoiceGroupList';
import { VoiceFilterChips } from '../../components/common/VoiceFilterChips';
import { useAttendanceKeyboard } from '../../hooks/useAttendanceKeyboard';
import { formatDateLong, formatDateNumeric } from '../../utils/dateFormatting';

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
  const [voiceFilter, setVoiceFilter] = useState<string | null>(null);
  const { collapsedVoices, toggle: toggleVoiceCollapse, collapseAll } = useCollapsedVoices();

  const [saving, setSaving] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [focusedMemberId, setFocusedMemberId] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Stable refs to avoid stale closures
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
    collapseAll([]);
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
    return matchesName && (!voiceFilter || r.choirVoice?.name === voiceFilter);
  });

  const voiceNames = [...new Set(records.map((r) => r.choirVoice?.name).filter(Boolean) as string[])];
  const groups = voiceNames
    .map((voice) => ({
      voice,
      members: filteredRecords.filter((r) => r.choirVoice?.name === voice),
    }))
    .filter((g) => g.members.length > 0);

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

  const { ctrlHeld } = useAttendanceKeyboard({
    recordsRef,
    visibleMembersRef,
    focusedMemberIdRef,
    toggleAttendanceRef,
    searchInputRef,
    rowRefs,
    setFocusedMemberId,
  });

  const voiceGroupData: VoiceGroupData[] = groups.map((group) => {
    const groupAttended = group.members.filter((m) => m.attended).length;
    return {
      voice: group.voice,
      headerRight: (
        <span className="text-xs font-normal text-default-500">
          {groupAttended} / {group.members.length} anwesend
        </span>
      ),
      rows: group.members.map((member) => {
        const isFocused = focusedMemberId === member.id;
        const isSaving = saving === member.id;
        const visibleIdx = visibleMembers.findIndex((m) => m.id === member.id);
        const shortcutNum = ctrlHeld && visibleIdx >= 0 && visibleIdx < 9 ? visibleIdx + 1 : null;
        return {
          key: member.id,
          content: (
            <div
              data-testid="attendance-member-row"
              data-member-id={member.id}
              ref={(el) => {
                if (el) rowRefs.current.set(member.id, el);
                else rowRefs.current.delete(member.id);
              }}
              className={[
                'grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_160px_110px] items-center px-4 py-3 transition-colors',
                member.attended ? 'bg-success-50 dark:bg-success-900/20' : 'bg-content1',
                isFocused ? 'ring-2 ring-inset ring-primary' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => setFocusedMemberId(member.id)}
            >
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">
                  {member.lastName}, {member.firstName}
                </p>
                <p className="text-xs text-default-400 sm:hidden mt-0.5">
                  {formatLastAttended(member.lastAttendedRehearsalsAgo)}
                </p>
              </div>
              <p className="hidden sm:block text-sm text-default-500">
                {formatLastAttended(member.lastAttendedRehearsalsAgo)}
              </p>
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
          ),
        };
      }),
    };
  });

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <h1 className="text-2xl font-bold">Anwesenheit erfassen</h1>

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
              <SelectItem key={r.id} textValue={`${formatDateNumeric(r.date)} – ${r.title}`}>
                {formatDateNumeric(r.date)} – {r.title}
              </SelectItem>
            ))}
          </SelectSection>
          <SelectSection title="Vergangene Proben">
            {pastRehearsals.map((r) => (
              <SelectItem key={r.id} textValue={`${formatDateNumeric(r.date)} – ${r.title}`}>
                {formatDateNumeric(r.date)} – {r.title}
              </SelectItem>
            ))}
          </SelectSection>
        </Select>

        {selectedRehearsal && !loadingRecords && (
          <p className="text-sm text-default-500 px-1">
            {formatDateLong(selectedRehearsal.date)} ·{' '}
            <span className="font-medium text-success-600">{attendedCount}</span> von{' '}
            {records.length} anwesend
          </p>
        )}
        {loadingRecords && <Spinner size="sm" />}
      </div>

      {selectedRehearsalId && !loadingRecords && (
        <>
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
            <VoiceFilterChips
              voices={voiceNames}
              selected={voiceFilter}
              onChange={setVoiceFilter}
            />
          </div>

          {saveError && (
            <p className="text-sm text-danger text-center">{saveError}</p>
          )}

          <VoiceGroupList
            groups={voiceGroupData}
            collapsedVoices={collapsedVoices}
            onToggle={toggleVoiceCollapse}
            header={
              <div className="hidden sm:grid sm:grid-cols-[1fr_160px_110px] px-4 py-2 bg-default-50 border-b border-divider text-xs font-semibold text-default-500 uppercase tracking-wide">
                <span>Name</span>
                <span>Letzte Probe</span>
                <span className="text-right">Anwesenheit</span>
              </div>
            }
            emptyState={
              <p className="text-center text-default-400 py-10 text-sm">
                Keine Mitglieder gefunden
              </p>
            }
          />

          <p className="hidden sm:block text-xs text-default-400 text-center">
            ↑↓ navigieren · Leertaste/Enter umschalten · / suchen · Strg+1–9 erfassen
          </p>
        </>
      )}
    </div>
  );
}
