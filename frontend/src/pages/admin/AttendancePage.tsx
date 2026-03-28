import { useEffect, useRef, useState } from 'react';
import {
  Select,
  SelectItem,
  SelectSection,
  Input,
  Button,
  Spinner,
  useDisclosure,
} from '@heroui/react';
import { QrCodeIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { rehearsalsApi, attendanceApi, adminMembersApi } from '../../services/api';
import { CreateMemberModal } from '../../components/member/CreateMemberModal';
import { MemberDetailModal } from '../../components/member/MemberDetailModal';
import { QrScannerModal, type QrScanResult } from '../../components/attendance/QrScannerModal';
import { QrScanResultModal } from '../../components/attendance/QrScanResultModal';
import type { Rehearsal, AttendanceRecord, MemberOverview } from '../../types';
import { VoiceGroupList, useCollapsedVoices } from '../../components/common/VoiceGroupList';
import type { VoiceGroupData } from '../../components/common/VoiceGroupList';
import { VoiceFilterChips } from '../../components/common/VoiceFilterChips';
import { useAttendanceKeyboard } from '../../hooks/useAttendanceKeyboard';
import { useDateLocale } from '../../hooks/useDateLocale';
import { formatDateLong, formatDateNumeric } from '../../utils/dateFormatting';
import { adminInputClassNames, adminSelectClassNames } from '../../styles/adminFormStyles';

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
  const { isOpen: isMemberOpen, onOpen: onMemberOpen, onClose: onMemberClose } = useDisclosure();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const { isOpen: isCreateOpen, onOpen: onCreateOpen, onClose: onCreateClose } = useDisclosure();
  const { isOpen: isScannerOpen, onOpen: onScannerOpen, onClose: onScannerClose } = useDisclosure();
  const { isOpen: isScanResultOpen, onOpen: onScanResultOpen, onClose: onScanResultClose } = useDisclosure();
  const [scanResult, setScanResult] = useState<QrScanResult | null>(null);
  const [scanRecordSaving, setScanRecordSaving] = useState(false);
  const [scanRecordError, setScanRecordError] = useState<string | null>(null);
  const [unexcusedByMemberId, setUnexcusedByMemberId] = useState<Record<string, number>>({});
  const [emailByMemberId, setEmailByMemberId] = useState<Record<string, string>>({});

  const { t, i18n } = useTranslation();
  const dateLocale = useDateLocale();

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
    .filter((r) => !r.isOptional && new Date(r.date) < startOfToday)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const futureRehearsals = rehearsals
    .filter((r) => !r.isOptional && new Date(r.date) >= startOfToday)
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
      setSaveError(t('attendance.save_failed'));
    } finally {
      setSaving(null);
    }
  };

  const toggleAttendanceRef = useRef(toggleAttendance);
  toggleAttendanceRef.current = toggleAttendance;

  const handleMemberCreatedWithId = async (memberId: string) => {
    const currentAttendedIds = recordsRef.current.filter((r) => r.attended).map((r) => r.id);
    await attendanceApi.bulkSetRecords(selectedRehearsalIdRef.current, [...currentAttendedIds, memberId]);
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
    const hasNoPlan = member.plan === null;
    const unexcusedAbsenceCount = unexcusedByMemberId[member.id];
    const hasHighUnexcusedAbsences = typeof unexcusedAbsenceCount === 'number' && unexcusedAbsenceCount > 3;
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
            <p
              className="font-medium text-sm truncate cursor-pointer hover:text-primary transition-colors"
              onClick={(e) => { e.stopPropagation(); openMemberDetail(member); }}
            >
              {member.firstName} {member.lastName}
            </p>
            {hasNoPlan && (
              <p className="text-xs text-danger mt-0.5">
                {t('attendance.no_plan_notice')}
              </p>
            )}
            {hasHighUnexcusedAbsences && (
              <p className="text-xs text-danger mt-0.5">
                {t('attendance.unexcused_warning', { count: unexcusedAbsenceCount })}
              </p>
            )}
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
              {member.attended ? t('attendance.btn_present') : t('attendance.btn_record')}
            </Button>
          </div>
        </div>
      ),
    };
  };

  const noVoiceGroupEntry: VoiceGroupData[] = noVoiceMembers.length > 0 ? [{
    voice: NO_VOICE_KEY,
    label: t('attendance.no_voice_group'),
    headerRight: (
      <span className="text-xs font-normal text-default-500">
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
          <span className="text-xs font-normal text-default-500">
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

      <div className="flex flex-col gap-2">
        <Select
          label={t('attendance.rehearsal_label')}
          placeholder={t('attendance.select_rehearsal')}
          selectedKeys={selectedRehearsalId ? [selectedRehearsalId] : []}
          classNames={adminSelectClassNames}
          onSelectionChange={(keys) => {
            const id = Array.from(keys)[0] as string;
            setSelectedRehearsalId(id ?? '');
          }}
        >
          <SelectSection showDivider title={t('attendance.upcoming_rehearsals')}>
            {futureRehearsals.map((r) => (
              <SelectItem key={r.id} textValue={`${formatDateNumeric(r.date, dateLocale)} – ${r.title}`}>
                {formatDateNumeric(r.date, dateLocale)} – {r.title}
              </SelectItem>
            ))}
          </SelectSection>
          <SelectSection title={t('attendance.past_rehearsals')}>
            {pastRehearsals.map((r) => (
              <SelectItem key={r.id} textValue={`${formatDateNumeric(r.date, dateLocale)} – ${r.title}`}>
                {formatDateNumeric(r.date, dateLocale)} – {r.title}
              </SelectItem>
            ))}
          </SelectSection>
        </Select>

        {selectedRehearsal && !loadingRecords && (
          <p className="text-sm text-default-500 px-1">
            {formatDateLong(selectedRehearsal.date, dateLocale)} ·{' '}
            {t('attendance.present_of', { attended: attendedCount, total: records.length })}
          </p>
        )}
        {loadingRecords && <Spinner size="sm" />}
      </div>

      {selectedRehearsalId && !loadingRecords && (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Input
                ref={searchInputRef}
                placeholder={t('attendance.filter_name')}
                value={nameFilter}
                onValueChange={setNameFilter}
                onClear={() => setNameFilter('')}
                isClearable
                size="sm"
                className="flex-1"
                classNames={adminInputClassNames}
              />
              <Button
                size="sm"
                variant="flat"
                isIconOnly
                aria-label={t('checkin.admin_scan_button')}
                data-testid="attendance-open-qr-scanner"
                onPress={onScannerOpen}
              >
                <QrCodeIcon className="w-5 h-5" />
              </Button>
              <Button size="sm" color="primary" onPress={onCreateOpen}>
                {t('members.create_new')}
              </Button>
            </div>
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
                <span>{t('members.col_name')}</span>
                <span>{t('attendance.col_last_rehearsal')}</span>
                <span className="text-right">{t('attendance.col_attendance')}</span>
              </div>
            }
            emptyState={
              <p className="text-center text-default-400 py-10 text-sm">
                {t('attendance.no_members')}
              </p>
            }
          />

          <p className="hidden sm:block text-xs text-default-400 text-center">
            {t('attendance.keyboard_hint')}
          </p>
        </>
      )}

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
          onClose={onMemberClose}
          onDelete={(id) => setRecords((prev) => prev.filter((r) => r.id !== id))}
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
