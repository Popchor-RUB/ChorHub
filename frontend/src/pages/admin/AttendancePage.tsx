import { useEffect, useState, useCallback } from 'react';
import {
  Select,
  SelectItem,
  Input,
  Checkbox,
  Button,
  Card,
  CardBody,
  Chip,
  Spinner,
} from '@heroui/react';
import { rehearsalsApi, attendanceApi, adminMembersApi } from '../../services/api';
import type { Rehearsal, AttendanceRecord, MemberSearchResult, MemberHistory } from '../../types';
import { CHOIR_VOICE_LABELS } from '../../types';

export function AttendancePage() {
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [selectedRehearsalId, setSelectedRehearsalId] = useState<string>('');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MemberSearchResult[]>([]);
  const [selectedMemberHistory, setSelectedMemberHistory] = useState<MemberHistory | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    rehearsalsApi.getAll().then((res) => {
      setRehearsals(res.data as Rehearsal[]);
    });
  }, []);

  useEffect(() => {
    if (!selectedRehearsalId) return;
    setLoadingRecords(true);
    attendanceApi.getRecords(selectedRehearsalId).then((res) => {
      setRecords(res.data as AttendanceRecord[]);
      setLoadingRecords(false);
    });
  }, [selectedRehearsalId]);

  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults([]); return; }
    const res = await adminMembersApi.search(q);
    setSearchResults(res.data as MemberSearchResult[]);
  }, []);

  const handleSelectMember = async (member: MemberSearchResult) => {
    setSearchQuery(`${member.firstName} ${member.lastName}`);
    setSearchResults([]);
    const res = await adminMembersApi.history(member.id);
    setSelectedMemberHistory(res.data as MemberHistory);
  };

  const toggleAttendance = (memberId: string) => {
    setRecords((prev) =>
      prev.map((r) => (r.id === memberId ? { ...r, attended: !r.attended } : r)),
    );
  };

  const saveAttendance = async () => {
    if (!selectedRehearsalId) return;
    setSaving(true);
    const presentIds = records.filter((r) => r.attended).map((r) => r.id);
    await attendanceApi.bulkSetRecords(selectedRehearsalId, presentIds);
    setSaving(false);
  };

  const formatDate = (d: string) =>
    new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
      new Date(d),
    );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Anwesenheit erfassen</h1>

      {/* Member search */}
      <Card>
        <CardBody className="gap-3">
          <h2 className="font-semibold">Mitglied suchen</h2>
          <div className="relative">
            <Input
              placeholder="Name oder E-Mail eingeben..."
              value={searchQuery}
              onValueChange={handleSearch}
              label="Mitglied"
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 bg-background border border-divider rounded-lg shadow-lg mt-1">
                {searchResults.map((m) => (
                  <button
                    key={m.id}
                    className="w-full text-left px-4 py-2 hover:bg-default-100 text-sm"
                    onClick={() => handleSelectMember(m)}
                  >
                    <span className="font-medium">{m.lastName}, {m.firstName}</span>
                    <span className="ml-2 text-default-400">
                      {CHOIR_VOICE_LABELS[m.choirVoice]}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedMemberHistory && (
            <div className="mt-2 p-3 bg-default-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium">
                  {selectedMemberHistory.firstName} {selectedMemberHistory.lastName}
                </span>
                <Chip size="sm" variant="flat">
                  {CHOIR_VOICE_LABELS[selectedMemberHistory.choirVoice]}
                </Chip>
              </div>
              <p className="text-xs text-default-500 mb-1">Letzte Proben (anwesend):</p>
              {selectedMemberHistory.recentAttendance.length === 0 ? (
                <p className="text-xs text-default-400">Noch keine Proben besucht.</p>
              ) : (
                <ul className="text-sm space-y-1">
                  {selectedMemberHistory.recentAttendance.map((r) => (
                    <li key={r.id} className="text-default-600">
                      {formatDate(r.date)} – {r.title}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Rehearsal selection and attendance */}
      <Card>
        <CardBody className="gap-4">
          <h2 className="font-semibold">Probe auswählen</h2>
          <Select
            label="Probe"
            placeholder="Probe auswählen..."
            selectedKeys={selectedRehearsalId ? [selectedRehearsalId] : []}
            onSelectionChange={(keys) => setSelectedRehearsalId(Array.from(keys)[0] as string)}
          >
            {rehearsals.map((r) => (
              <SelectItem key={r.id}>
                {formatDate(r.date)} – {r.title}
              </SelectItem>
            ))}
          </Select>

          {selectedRehearsalId && (
            <>
              {loadingRecords ? (
                <div className="flex justify-center py-4"><Spinner /></div>
              ) : (
                <>
                  <div className="flex flex-col gap-2">
                    {records.map((record) => (
                      <div
                        key={record.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-default-50"
                      >
                        <Checkbox
                          isSelected={record.attended}
                          onValueChange={() => toggleAttendance(record.id)}
                        />
                        <div className="flex-1">
                          <span className="font-medium">
                            {record.lastName}, {record.firstName}
                          </span>
                        </div>
                        <Chip size="sm" variant="flat">
                          {CHOIR_VOICE_LABELS[record.choirVoice]}
                        </Chip>
                        {record.plan && (
                          <Chip
                            size="sm"
                            color={record.plan === 'CONFIRMED' ? 'success' : 'danger'}
                            variant="flat"
                          >
                            {record.plan === 'CONFIRMED' ? 'Zugesagt' : 'Abgesagt'}
                          </Chip>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-sm text-default-500">
                      {records.filter((r) => r.attended).length} von {records.length} anwesend
                    </span>
                    <Button color="primary" isLoading={saving} onPress={saveAttendance}>
                      Anwesenheit speichern
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
