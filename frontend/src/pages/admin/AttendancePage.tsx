import { useEffect, useState, useRef } from 'react';
import {
  Select,
  SelectItem,
  Input,
  Button,
  Card,
  CardBody,
  Chip,
  Spinner,
  Divider,
  SelectSection,
} from '@heroui/react';
import { rehearsalsApi, attendanceApi, adminMembersApi } from '../../services/api';
import type { Rehearsal, AttendanceRecord, MemberSearchResult, MemberHistory } from '../../types';
import { CHOIR_VOICE_LABELS } from '../../types';

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

export function AttendancePage() {
  // ── Step 1: Rehearsal selection ──────────────────────────────────────────
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [selectedRehearsalId, setSelectedRehearsalId] = useState<string>('');
  const [currentRecords, setCurrentRecords] = useState<AttendanceRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  // ── Step 2: Member autocomplete ──────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MemberSearchResult[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberHistory | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState<'confirmed' | 'removed' | null>(null);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load all rehearsals on mount
  useEffect(() => {
    rehearsalsApi.getAll().then(res => {
      setRehearsals(res.data as Rehearsal[])
    })
  }, []);

  // Split rehearsals into past and future
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const pastRehearsals = rehearsals
    .filter(r => new Date(r.date) < startOfToday)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // descending (most recent first)
  const futureRehearsals = rehearsals
    .filter(r => new Date(r.date) >= startOfToday)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // ascending (soonest first)

  // Load attendance records whenever rehearsal changes
  useEffect(() => {
    if (!selectedRehearsalId) {
      setCurrentRecords([]);
      return;
    }
    setLoadingRecords(true);
    setSelectedMember(null);
    setSearchQuery('');
    setSearchResults([]);
    attendanceApi.getRecords(selectedRehearsalId).then((res) => {
      setCurrentRecords(res.data as AttendanceRecord[]);
      setLoadingRecords(false);
    });
  }, [selectedRehearsalId]);

  // Debounced member search
  const handleSearch = (q: string) => {
    setSearchQuery(q);
    setSelectedMember(null);
    setSavedFeedback(null);

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      const res = await adminMembersApi.search(q);
      setSearchResults(res.data as MemberSearchResult[]);
    }, 250);
  };

  const handleSelectMember = async (member: MemberSearchResult) => {
    setSearchQuery(`${member.firstName} ${member.lastName}`);
    setSearchResults([]);
    setLoadingHistory(true);
    setSavedFeedback(null);
    const res = await adminMembersApi.history(member.id);
    setSelectedMember(res.data as MemberHistory);
    setLoadingHistory(false);
  };

  // Determine if the currently-selected member is already attended
  const isMemberAttended = selectedMember
    ? currentRecords.find((r) => r.id === selectedMember.id)?.attended ?? false
    : false;

  const toggleAttendance = async () => {
    if (!selectedMember || !selectedRehearsalId) return;
    setSaving(true);

    const updatedIds = isMemberAttended
      ? currentRecords.filter((r) => r.attended && r.id !== selectedMember.id).map((r) => r.id)
      : [
          ...currentRecords.filter((r) => r.attended).map((r) => r.id),
          selectedMember.id,
        ];

    await attendanceApi.bulkSetRecords(selectedRehearsalId, updatedIds);

    // Update local records state
    setCurrentRecords((prev) =>
      prev.map((r) =>
        r.id === selectedMember.id ? { ...r, attended: !isMemberAttended } : r,
      ),
    );
    setSavedFeedback(isMemberAttended ? 'removed' : 'confirmed');
    setSaving(false);
  };

  const selectedRehearsal = rehearsals.find((r) => r.id === selectedRehearsalId);
  const attendedCount = currentRecords.filter((r) => r.attended).length;

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <h1 className="text-2xl font-bold">Anwesenheit erfassen</h1>

      {/* ── Step 1: Rehearsal ── */}
      <Card>
        <CardBody className="gap-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-bold shrink-0">
              1
            </span>
            <h2 className="font-semibold">Probe auswählen</h2>
          </div>
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
            <p className="text-sm text-default-500">
              {formatDate(selectedRehearsal.date)} ·{' '}
              <span className="font-medium text-success-600">{attendedCount}</span> von{' '}
              {currentRecords.length} Mitgliedern anwesend
            </p>
          )}
          {loadingRecords && <Spinner size="sm" />}
        </CardBody>
      </Card>

      {/* ── Step 2: Member autocomplete ── */}
      {selectedRehearsalId && !loadingRecords && (
        <Card className="overflow-visible">
          <CardBody className="gap-3 overflow-visible">
            <div className="flex items-center gap-2 mb-1">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-bold shrink-0">
                2
              </span>
              <h2 className="font-semibold">Mitglied suchen</h2>
            </div>

            <div className="relative">
              <Input
                placeholder="Name eingeben..."
                value={searchQuery}
                onValueChange={handleSearch}
                onClear={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setSelectedMember(null);
                  setSavedFeedback(null);
                }}
                label="Mitglied"
                autoComplete="off"
                isClearable
              />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 bg-content1 border border-divider rounded-xl shadow-lg mt-1 overflow-hidden">
                  {searchResults.map((m) => (
                    <button
                      key={m.id}
                      className="w-full text-left px-4 py-2.5 hover:bg-default-100 text-sm flex items-center justify-between"
                      onMouseDown={(e) => e.preventDefault()} // prevents input blur before click
                      onClick={() => handleSelectMember(m)}
                    >
                      <span className="font-medium">
                        {m.lastName}, {m.firstName}
                      </span>
                      <Chip size="sm" variant="flat">
                        {CHOIR_VOICE_LABELS[m.choirVoice]}
                      </Chip>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Member detail card */}
            {loadingHistory && (
              <div className="flex justify-center py-4">
                <Spinner size="sm" />
              </div>
            )}

            {selectedMember && !loadingHistory && (
              <div className="flex flex-col gap-3 mt-1 p-4 bg-default-50 rounded-xl border border-divider">
                {/* Member info */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-base">
                      {selectedMember.firstName} {selectedMember.lastName}
                    </p>
                  </div>
                  <Chip size="sm" variant="flat" color="secondary">
                    {CHOIR_VOICE_LABELS[selectedMember.choirVoice]}
                  </Chip>
                </div>

                <Divider />

                {/* Last attended rehearsal */}
                <div>
                  <p className="text-xs text-default-400 uppercase tracking-wide mb-1">
                    Zuletzt anwesend
                  </p>
                  {selectedMember.recentAttendance.length > 0 ? (
                    <p className="text-sm text-default-700">
                      {formatDateShort(selectedMember.recentAttendance[0].date)} –{' '}
                      {selectedMember.recentAttendance[0].title}
                    </p>
                  ) : (
                    <p className="text-sm text-default-400 italic">Noch nie anwesend</p>
                  )}
                </div>

                <Divider />

                {/* Current status + action */}
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-default-400 uppercase tracking-wide mb-0.5">
                      Diese Probe
                    </p>
                    {isMemberAttended ? (
                      <Chip color="success" variant="flat" size="sm">
                        Anwesend ✓
                      </Chip>
                    ) : (
                      <Chip color="default" variant="flat" size="sm">
                        Nicht erfasst
                      </Chip>
                    )}
                  </div>
                  <Button
                    color={isMemberAttended ? 'danger' : 'success'}
                    variant={isMemberAttended ? 'bordered' : 'solid'}
                    isLoading={saving}
                    onPress={toggleAttendance}
                    size="sm"
                  >
                    {isMemberAttended ? 'Anwesenheit entfernen' : 'Anwesenheit bestätigen'}
                  </Button>
                </div>

                {savedFeedback && (
                  <p className="text-xs text-center text-default-500">
                    {savedFeedback === 'confirmed'
                      ? '✓ Anwesenheit gespeichert'
                      : '✓ Anwesenheit entfernt'}
                  </p>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
