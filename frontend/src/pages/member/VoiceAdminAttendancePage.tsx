import { useCallback, useEffect, useRef, useState } from 'react';
import { Spinner } from '@heroui/react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import { membersApi, rehearsalsApi, voiceAdminAttendanceApi } from '../../services/api';
import { AttendanceEditor } from '../../components/attendance/AttendanceEditor';
import { AttendanceMemberRow } from '../../components/attendance/AttendanceMemberRow';
import { QrScannerModal, type QrScanResult } from '../../components/attendance/QrScannerModal';
import { QrScanResultModal } from '../../components/attendance/QrScanResultModal';
import { VoiceAdminMemberDetailModal } from '../../components/member/VoiceAdminMemberDetailModal';
import { VoiceFilterChips } from '../../components/common/VoiceFilterChips';
import { VoiceGroupList } from '../../components/common/VoiceGroupList';
import type { VoiceGroupData } from '../../components/common/VoiceGroupList';
import { useCollapsedVoices } from '../../hooks/useCollapsedVoices';
import type { MemberProfile, Rehearsal, VoiceAttendanceRecord } from '../../types';

function formatRelativeDateTime(isoDate: string, locale: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return '—';
  const diffMs = parsed.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (abs < minute) return formatter.format(Math.round(diffMs / 1000), 'second');
  if (abs < hour) return formatter.format(Math.round(diffMs / minute), 'minute');
  if (abs < day) return formatter.format(Math.round(diffMs / hour), 'hour');
  return formatter.format(Math.round(diffMs / day), 'day');
}

export function VoiceAdminAttendancePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [selectedRehearsalId, setSelectedRehearsalId] = useState('');
  const [records, setRecords] = useState<VoiceAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [voiceFilter, setVoiceFilter] = useState<string | null>(null);
  const { collapsedVoices, toggle: toggleVoiceCollapse } = useCollapsedVoices();
  const [scanResult, setScanResult] = useState<QrScanResult | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [scanSaving, setScanSaving] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [detailMember, setDetailMember] = useState<VoiceAttendanceRecord | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [recordsError, setRecordsError] = useState(false);
  const savingRef = useRef(false);
  savingRef.current = savingMemberId !== null || scanSaving;

  const handleAccessRevoked = useCallback(() => {
    setProfile(null);
    setRehearsals([]);
    setSelectedRehearsalId('');
    setRecords([]);
    setScanResult(null);
    setScanError(null);
    setResultOpen(false);
    setScannerOpen(false);
    setScanSaving(false);
    setDetailMember(null);
    navigate('/proben', { replace: true });
  }, [navigate]);

  useEffect(() => {
    let active = true;
    Promise.all([membersApi.me(), rehearsalsApi.getAllForMember()])
      .then(([profileResponse, rehearsalsResponse]) => {
        if (!active) return;
        setProfile(profileResponse.data);
        setRehearsals(rehearsalsResponse.data as Rehearsal[]);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (axios.isAxiosError(error) && error.response?.status === 403) handleAccessRevoked();
        else setLoadError(true);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [handleAccessRevoked]);

  useEffect(() => {
    if (!selectedRehearsalId) {
      setRecords([]);
      return;
    }
    let active = true;
    setLoadingRecords(true);
    setRecordsError(false);
    setSearch('');
    voiceAdminAttendanceApi.getRecords(selectedRehearsalId)
      .then((response) => { if (active) setRecords(response.data); })
      .catch((error: unknown) => {
        if (!active) return;
        setRecords([]);
        if (axios.isAxiosError(error) && error.response?.status === 403) handleAccessRevoked();
        else setRecordsError(true);
      })
      .finally(() => { if (active) setLoadingRecords(false); });
    return () => { active = false; };
  }, [handleAccessRevoked, selectedRehearsalId]);

  useEffect(() => {
    if (!selectedRehearsalId) return;
    let active = true;
    let inFlight = false;
    const interval = setInterval(() => {
      if (savingRef.current || inFlight) return;
      inFlight = true;
      voiceAdminAttendanceApi.getRecords(selectedRehearsalId)
        .then((response) => {
          if (!active || savingRef.current) return;
          setRecords(response.data);
          setRecordsError(false);
        })
        .catch((error: unknown) => {
          if (!active) return;
          if (axios.isAxiosError(error) && error.response?.status === 403) handleAccessRevoked();
          else setRecordsError(true);
        })
        .finally(() => { inFlight = false; });
    }, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [handleAccessRevoked, selectedRehearsalId]);

  const formatLastAttended = (ago: number | null) => {
    if (ago === null) return t('attendance.last_never');
    if (ago === 1) return t('attendance.last_previous');
    return t('attendance.last_ago', { count: ago });
  };

  const scannedMember = scanResult ? records.find((record) => record.id === scanResult.payload.memberId) ?? null : null;
  const memberInfoFetchError = Boolean(scanResult && !scannedMember);
  const scannedMemberPlanText = scannedMember?.plan === 'CONFIRMED'
    ? t('detail_modal.plan_confirmed')
    : scannedMember?.plan === 'DECLINED'
      ? t('detail_modal.plan_declined')
      : t('detail_modal.plan_none');

  const toggleAttendance = async (member: VoiceAttendanceRecord) => {
    if (savingMemberId || !selectedRehearsalId) return;
    const attended = !member.attended;
    setSavingMemberId(member.id);
    setRecords((current) => current.map((record) => record.id === member.id ? { ...record, attended } : record));
    try {
      await voiceAdminAttendanceApi.setRecord(selectedRehearsalId, member.id, attended);
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        handleAccessRevoked();
        return;
      }
      setRecords((current) => current.map((record) => record.id === member.id ? { ...record, attended: member.attended } : record));
    } finally {
      setSavingMemberId(null);
    }
  };

  const closeResult = () => {
    setResultOpen(false);
    setScanResult(null);
    setScanError(null);
    setScanSaving(false);
  };

  const openResult = (result: QrScanResult) => {
    setScanResult(result);
    setScanError(null);
    setResultOpen(true);
  };

  const recordScanAttendance = async () => {
    if (!scanResult || !scannedMember || !selectedRehearsalId || !scanResult.signatureValid || scanSaving) return;
    const attended = !scannedMember.attended;
    setScanSaving(true);
    setScanError(null);
    setRecords((current) => current.map((record) => record.id === scannedMember.id ? { ...record, attended } : record));
    try {
      await voiceAdminAttendanceApi.setRecord(selectedRehearsalId, scannedMember.id, attended);
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        handleAccessRevoked();
        return;
      }
      setRecords((current) => current.map((record) => record.id === scannedMember.id ? { ...record, attended: scannedMember.attended } : record));
      setScanError(t('attendance.save_failed'));
    } finally {
      setScanSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center pt-8"><Spinner /></div>;
  if (loadError) return <p className="text-danger">{t('common.error_generic')}</p>;
  if (!profile?.voiceAdminVoices?.length) return <Navigate to="/proben" replace />;

  const relativeIssuedAt = scanResult ? formatRelativeDateTime(scanResult.payload.issuedAt, i18n.language) : '';
  const voiceNames = profile.voiceAdminVoices.map((voice) => voice.name)
    .sort((a, b) => a.localeCompare(b, i18n.language));
  const hasMultipleVoices = voiceNames.length > 1;
  const sortMembers = (members: VoiceAttendanceRecord[]) => [...members].sort((a, b) =>
    a.firstName.localeCompare(b.firstName, i18n.language)
    || a.lastName.localeCompare(b.lastName, i18n.language));
  const renderMemberRow = (member: VoiceAttendanceRecord) => (
    <AttendanceMemberRow
      key={member.id}
      member={member}
      saving={savingMemberId === member.id}
      onToggle={() => void toggleAttendance(member)}
      onOpenDetail={() => setDetailMember(member)}
      formatLastAttended={formatLastAttended}
      testId="attendance-member-row"
    />
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-8" data-testid="voice-admin-attendance-page">
      <h1 className="text-2xl font-bold">{t('attendance.record_title')}</h1>

      <AttendanceEditor
        rehearsals={rehearsals}
        selectedRehearsalId={selectedRehearsalId}
        onSelectRehearsal={setSelectedRehearsalId}
        records={records}
        loadingRecords={loadingRecords}
        search={search}
        onSearchChange={setSearch}
        onOpenScanner={() => setScannerOpen(true)}
        belowSearch={hasMultipleVoices && (
          <VoiceFilterChips voices={voiceNames} selected={voiceFilter} onChange={setVoiceFilter} />
        )}
        statusMessage={recordsError && <p className="text-danger text-sm">{t('common.error_generic')}</p>}
        renderRecords={(filteredRecords) => {
          const visibleRecords = sortMembers(filteredRecords.filter((member) =>
            !hasMultipleVoices || !voiceFilter || member.choirVoice?.name === voiceFilter));
          const groups: VoiceGroupData[] = hasMultipleVoices ? voiceNames
            .map((voice) => {
              const members = visibleRecords.filter((member) => member.choirVoice?.name === voice);
              return {
                voice,
                headerRight: (
                  <span className="block w-full text-left text-xs font-normal text-muted sm:w-auto sm:text-right">
                    {t('attendance.group_present', { attended: members.filter((member) => member.attended).length, total: members.length })}
                  </span>
                ),
                rows: members.map((member) => ({ key: member.id, content: renderMemberRow(member) })),
              };
            })
            .filter((group) => group.rows.length > 0) : [];
          return hasMultipleVoices ? (
            <VoiceGroupList
              groups={groups}
              collapsedVoices={collapsedVoices}
              onToggle={toggleVoiceCollapse}
              header={
                <div className="hidden sm:grid sm:grid-cols-[1fr_160px_110px] px-4 py-2 bg-surface-secondary border-b border-separator text-xs font-semibold text-muted uppercase tracking-wide">
                  <span>{t('members.col_name')}</span>
                  <span>{t('attendance.col_last_rehearsal')}</span>
                  <span className="text-right">{t('attendance.col_attendance')}</span>
                </div>
              }
              emptyState={<p className="px-4 py-8 text-center text-sm text-muted">{t('attendance.no_members')}</p>}
            />
          ) : (
          <div className="overflow-hidden rounded-xl border border-separator">
            <div className="hidden sm:grid sm:grid-cols-[1fr_160px_110px] px-4 py-2 bg-surface-secondary border-b border-separator text-xs font-semibold text-muted uppercase tracking-wide">
              <span>{t('members.col_name')}</span>
              <span>{t('attendance.col_last_rehearsal')}</span>
              <span className="text-right">{t('attendance.col_attendance')}</span>
            </div>
            {visibleRecords.map(renderMemberRow)}
            {visibleRecords.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted">{t('attendance.no_members')}</p>}
          </div>
          );
        }}
      />

      <QrScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={openResult}
        verificationScope="voice-admin"
      />
      <QrScanResultModal
        isOpen={resultOpen}
        scanResult={scanResult}
        memberEmail=""
        memberName={scannedMember ? `${scannedMember.firstName} ${scannedMember.lastName}` : undefined}
        showEmail={false}
        relativeIssuedAt={relativeIssuedAt}
        lastAttendedText={scannedMember ? formatLastAttended(scannedMember.lastAttendedRehearsalsAgo) : '—'}
        lastAttendedRehearsalsAgo={scannedMember?.lastAttendedRehearsalsAgo ?? null}
        attendancePlanText={scannedMemberPlanText}
        attendancePlanMissing={scannedMember?.plan === null}
        unexcusedAbsenceCount={null}
        scannedMemberAttended={Boolean(scannedMember?.attended)}
        scanRecordSaving={scanSaving}
        scanRecordError={scanError}
        memberInfoFetchError={memberInfoFetchError}
        canOpenMemberDetail={Boolean(scannedMember)}
        onClose={closeResult}
        onRecordAttendance={() => void recordScanAttendance()}
        onScanNext={() => { closeResult(); setScannerOpen(true); }}
        onOpenMemberDetail={() => {
          if (!scannedMember) return;
          setDetailMember(scannedMember);
          closeResult();
        }}
      />
      <VoiceAdminMemberDetailModal
        key={detailMember?.id ?? 'closed'}
        member={detailMember}
        isOpen={detailMember !== null}
        onClose={() => setDetailMember(null)}
        onAccessRevoked={handleAccessRevoked}
      />
    </div>
  );
}
