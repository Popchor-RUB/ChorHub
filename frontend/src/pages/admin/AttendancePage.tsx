import { useEffect, useRef, useState } from 'react';
import { Button, useOverlayState } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { rehearsalsApi, attendanceApi, adminMembersApi } from '../../services/api';
import { CreateMemberModal } from '../../components/member/CreateMemberModal';
import { MemberDetailModal } from '../../components/member/MemberDetailModal';
import { QrScannerModal, type QrScanResult } from '../../components/attendance/QrScannerModal';
import { QrScanResultModal } from '../../components/attendance/QrScanResultModal';
import type { Rehearsal, AttendanceRecord, MemberOverview } from '../../types';
import { VoiceGroupList } from '../../components/common/VoiceGroupList';
import type { VoiceGroupData } from '../../components/common/VoiceGroupList';
import { useCollapsedVoices } from '../../hooks/useCollapsedVoices';
import { VoiceFilterChips } from '../../components/common/VoiceFilterChips';
import { useAttendanceKeyboard } from '../../hooks/useAttendanceKeyboard';
import { AttendanceMemberRow } from '../../components/attendance/AttendanceMemberRow';
import { AttendanceEditor } from '../../components/attendance/AttendanceEditor';

const NO_VOICE_KEY = '__no_voice__';

function formatRelativeDateTime(isoDate: string, locale: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return '—';
  const diffMs = parsed.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (abs < minute) return rtf.format(Math.round(diffMs / 1000), 'second');
  if (abs < hour) return rtf.format(Math.round(diffMs / minute), 'minute');
  if (abs < day) return rtf.format(Math.round(diffMs / hour), 'hour');
  return rtf.format(Math.round(diffMs / day), 'day');
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

  const [selectedMember, setSelectedMember] = useState<AttendanceRecord | null>(null);
  const { isOpen: isMemberOpen, open: onMemberOpen, close: onMemberClose } = useOverlayState();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const { isOpen: isCreateOpen, open: onCreateOpen, close: onCreateClose } = useOverlayState();
  const { isOpen: isScannerOpen, open: onScannerOpen, close: onScannerClose } = useOverlayState();
  const { isOpen: isScanResultOpen, open: onScanResultOpen, close: onScanResultClose } = useOverlayState();
  const [scanResult, setScanResult] = useState<QrScanResult | null>(null);
  const [scanRecordSaving, setScanRecordSaving] = useState(false);
  const [scanRecordError, setScanRecordError] = useState<string | null>(null);
  const [unexcusedByMemberId, setUnexcusedByMemberId] = useState<Record<string, number>>({});
  const [emailByMemberId, setEmailByMemberId] = useState<Record<string, string>>({});

  const { t, i18n } = useTranslation();

  // Stable refs to avoid stale closures
  const recordsRef = useRef(records);
  recordsRef.current = records;
  const selectedRehearsalIdRef = useRef(selectedRehearsalId);
  selectedRehearsalIdRef.current = selectedRehearsalId;
  const savingRef = useRef(saving);
  savingRef.current = saving;

  useEffect(() => {
    rehearsalsApi.getAll().then((res) => setRehearsals(res.data as Rehearsal[]));
    adminMembersApi.list().then((res) => {
      const members = res.data as MemberOverview[];
      setUnexcusedByMemberId(Object.fromEntries(members.map((m) => [m.id, m.unexcusedAbsenceCount])));
      setEmailByMemberId(Object.fromEntries(members.map((m) => [m.id, m.email])));
    });
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
  }, [collapseAll, selectedRehearsalId]);

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

  // No-voice members are always shown regardless of the voice filter — only the name filter applies.
  const noVoiceMembers = records.filter((r) => {
    if (r.choirVoice) return false;
    const q = nameFilter.toLowerCase();
    return !q ||
      `${r.lastName} ${r.firstName}`.toLowerCase().includes(q) ||
      `${r.firstName} ${r.lastName}`.toLowerCase().includes(q);
  });

  const visibleMembers = [
    ...groups.filter((g) => !collapsedVoices.has(g.voice)).flatMap((g) => g.members),
    ...(noVoiceMembers.length > 0 && !collapsedVoices.has(NO_VOICE_KEY) ? noVoiceMembers : []),
  ];

  const visibleMembersRef = useRef(visibleMembers);
  visibleMembersRef.current = visibleMembers;

  const focusedMemberIdRef = useRef(focusedMemberId);
  focusedMemberIdRef.current = focusedMemberId;

  const toggleAttendance = async (memberId: string, currentlyAttended: boolean) => {
    if (saving) return;
    setSaving(memberId);
    setSaveError(null);

    setRecords((prev) =>
      prev.map((r) => (r.id === memberId ? { ...r, attended: !currentlyAttended } : r)),
    );

    try {
      await attendanceApi.setRecord(selectedRehearsalIdRef.current, memberId, !currentlyAttended);
    } catch {
      setRecords((prev) =>
        prev.map((r) => (r.id === memberId ? { ...r, attended: currentlyAttended } : r)),
      );
      setSaveError(t('attendance.save_failed'));
    } finally {
      setSaving(null);
    }
  };

  const toggleAttendanceRef = useRef(toggleAttendance);
  toggleAttendanceRef.current = toggleAttendance;

  const handleMemberCreatedWithId = async (memberId: string) => {
    await attendanceApi.setRecord(selectedRehearsalIdRef.current, memberId, true);
    const res = await attendanceApi.getRecords(selectedRehearsalIdRef.current);
    setRecords(res.data as AttendanceRecord[]);
  };

  const { ctrlHeld } = useAttendanceKeyboard({
    recordsRef,
    visibleMembersRef,
    focusedMemberIdRef,
    toggleAttendanceRef,
    searchInputRef,
    rowRefs,
    setFocusedMemberId,
  });

  const formatLastAttended = (ago: number | null): string => {
    if (ago === null) return t('attendance.last_never');
    if (ago === 1) return t('attendance.last_previous');
    return t('attendance.last_ago', { count: ago });
  };

  const relativeIssuedAt = scanResult
    ? formatRelativeDateTime(scanResult.payload.issuedAt, i18n.language)
    : '';
  const scannedMember = scanResult
    ? records.find((r) => r.id === scanResult.payload.memberId)
    : null;
  const scannedMemberInfoFetchError = Boolean(scanResult && !scannedMember);
  const scannedMemberAttended = Boolean(scannedMember?.attended);
  const scannedMemberEmail = scanResult
    ? (emailByMemberId[scanResult.payload.memberId] ?? '—')
    : '—';
  const scannedMemberLastAttendedText = scannedMember
    ? formatLastAttended(scannedMember.lastAttendedRehearsalsAgo)
    : '—';
  const scannedMemberLastAttendedRehearsalsAgo = scannedMember?.lastAttendedRehearsalsAgo ?? null;
  const scannedMemberPlanText = scannedMember?.plan === 'CONFIRMED'
    ? t('detail_modal.plan_confirmed')
    : scannedMember?.plan === 'DECLINED'
      ? t('detail_modal.plan_declined')
      : t('detail_modal.plan_none');
  const scannedMemberPlanMissing = scannedMember?.plan === null;
  const scannedMemberUnexcusedAbsenceCount = scanResult
    ? (unexcusedByMemberId[scanResult.payload.memberId] ?? null)
    : null;

  const openMemberDetail = (member: AttendanceRecord) => {
    setSelectedMember(member);
    onMemberOpen();
  };

  const closeScanResultModal = () => {
    setScanRecordError(null);
    setScanRecordSaving(false);
    setScanResult(null);
    onScanResultClose();
  };

  const handleScanSuccess = (result: QrScanResult) => {
    setScanRecordError(null);
    setScanRecordSaving(false);
    setScanResult(result);
    onScanResultOpen();
  };

  const handleCreateAttendanceFromScan = async () => {
    if (!scanResult || !selectedRehearsalIdRef.current || scanRecordSaving) return;
    if (scannedMemberInfoFetchError) {
      setScanRecordError(t('checkin.admin_member_info_fetch_error'));
      return;
    }
    setScanRecordSaving(true);
    setScanRecordError(null);

    const memberId = scanResult.payload.memberId;
    const currentlyAttended = recordsRef.current.some((r) => r.id === memberId && r.attended);

    setRecords((prev) =>
      prev.map((r) => (r.id === memberId ? { ...r, attended: !currentlyAttended } : r)),
    );

    try {
      await attendanceApi.setRecord(selectedRehearsalIdRef.current, memberId, !currentlyAttended);
    } catch {
      setRecords((prev) =>
        prev.map((r) => (r.id === memberId ? { ...r, attended: currentlyAttended } : r)),
      );
      setScanRecordError(t('attendance.save_failed'));
    } finally {
      setScanRecordSaving(false);
    }
  };

  const handleScanNextFromResult = () => {
    setScanRecordError(null);
    setScanRecordSaving(false);
    setScanResult(null);
    onScanResultClose();
    onScannerOpen();
  };

  const buildMemberRow = (member: AttendanceRecord) => {
    const isFocused = focusedMemberId === member.id;
    const isSaving = saving === member.id;
    const visibleIdx = visibleMembers.findIndex((m) => m.id === member.id);
    const shortcutNum = ctrlHeld && visibleIdx >= 0 && visibleIdx < 9 ? visibleIdx + 1 : null;
    const unexcusedAbsenceCount = unexcusedByMemberId[member.id];
    return {
      key: member.id,
      content: (
        <AttendanceMemberRow
          member={member}
          saving={isSaving}
          formatLastAttended={formatLastAttended}
          onToggle={() => void toggleAttendance(member.id, member.attended)}
          onOpenDetail={() => openMemberDetail(member)}
          focused={isFocused}
          shortcutNum={shortcutNum}
          unexcusedAbsenceCount={unexcusedAbsenceCount}
          rowRef={(el) => {
            if (el) rowRefs.current.set(member.id, el);
            else rowRefs.current.delete(member.id);
          }}
          onFocus={() => setFocusedMemberId(member.id)}
        />
      ),
    };
  };

  const noVoiceGroupEntry: VoiceGroupData[] = noVoiceMembers.length > 0 ? [{
    voice: NO_VOICE_KEY,
    label: t('attendance.no_voice_group'),
    headerRight: (
      <span className="block w-full text-left text-xs font-normal text-muted sm:w-auto sm:text-right">
        {t('attendance.group_present', { attended: noVoiceMembers.filter((m) => m.attended).length, total: noVoiceMembers.length })}
      </span>
    ),
    rows: noVoiceMembers.map(buildMemberRow),
  }] : [];

  const voiceGroupData: VoiceGroupData[] = [
    ...groups.map((group) => {
      const groupAttended = group.members.filter((m) => m.attended).length;
      return {
        voice: group.voice,
        headerRight: (
          <span className="block w-full text-left text-xs font-normal text-muted sm:w-auto sm:text-right">
            {t('attendance.group_present', { attended: groupAttended, total: group.members.length })}
          </span>
        ),
        rows: group.members.map(buildMemberRow),
      };
    }),
    ...noVoiceGroupEntry,
  ];

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <h1 className="text-2xl font-bold">{t('attendance.record_title')}</h1>

      <AttendanceEditor
        rehearsals={rehearsals}
        selectedRehearsalId={selectedRehearsalId}
        onSelectRehearsal={setSelectedRehearsalId}
        records={records}
        loadingRecords={loadingRecords}
        search={nameFilter}
        onSearchChange={setNameFilter}
        searchRef={searchInputRef}
        onOpenScanner={onScannerOpen}
        extraActions={<Button size="sm" onPress={onCreateOpen}>{t('members.create_new')}</Button>}
        belowSearch={(
          <VoiceFilterChips voices={voiceNames} selected={voiceFilter} onChange={setVoiceFilter} />
        )}
        statusMessage={saveError && <p className="text-sm text-danger text-center">{saveError}</p>}
        renderRecords={() => (
          <>
            <VoiceGroupList
              groups={voiceGroupData}
              collapsedVoices={collapsedVoices}
              onToggle={toggleVoiceCollapse}
              header={
                <div className="hidden sm:grid sm:grid-cols-[1fr_160px_110px] px-4 py-2 bg-surface-secondary border-b border-separator text-xs font-semibold text-muted uppercase tracking-wide">
                  <span>{t('members.col_name')}</span>
                  <span>{t('attendance.col_last_rehearsal')}</span>
                  <span className="text-right">{t('attendance.col_attendance')}</span>
                </div>
              }
              emptyState={
                <p className="text-center text-muted py-10 text-sm">{t('attendance.no_members')}</p>
              }
            />
            <p className="hidden sm:block text-xs text-muted text-center">{t('attendance.keyboard_hint')}</p>
          </>
        )}
      />

      <CreateMemberModal
        isOpen={isCreateOpen}
        onClose={onCreateClose}
        onCreated={() => {}}
        onCreatedWithId={handleMemberCreatedWithId}
      />

      {selectedMember && (
        <MemberDetailModal
          member={selectedMember}
          isOpen={isMemberOpen}
          showComment
          onCommentChanged={(memberId, comment) => {
            setRecords((current) => current.map((record) => record.id === memberId ? { ...record, internalComment: comment } : record));
            setSelectedMember((current) => current?.id === memberId ? { ...current, internalComment: comment } : current);
          }}
          onClose={onMemberClose}
          onStatusChanged={(id) => setRecords((prev) => prev.filter((record) => record.id !== id))}
        />
      )}

      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={onScannerClose}
        onScanSuccess={handleScanSuccess}
      />

      <QrScanResultModal
        isOpen={isScanResultOpen}
        scanResult={scanResult}
        memberEmail={scannedMemberEmail}
        relativeIssuedAt={relativeIssuedAt}
        lastAttendedText={scannedMemberLastAttendedText}
        lastAttendedRehearsalsAgo={scannedMemberLastAttendedRehearsalsAgo}
        attendancePlanText={scannedMemberPlanText}
        attendancePlanMissing={scannedMemberPlanMissing}
        unexcusedAbsenceCount={scannedMemberUnexcusedAbsenceCount}
        scannedMemberAttended={scannedMemberAttended}
        scanRecordSaving={scanRecordSaving}
        scanRecordError={scanRecordError}
        memberInfoFetchError={scannedMemberInfoFetchError}
        canOpenMemberDetail={Boolean(scannedMember)}
        onClose={closeScanResultModal}
        onRecordAttendance={handleCreateAttendanceFromScan}
        onScanNext={handleScanNextFromResult}
        onOpenMemberDetail={() => {
          if (!scannedMember) return;
          openMemberDetail(scannedMember);
        }}
      />
    </div>
  );
}
