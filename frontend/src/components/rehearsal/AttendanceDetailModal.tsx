import { useEffect, useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Modal, ModalContent, ModalHeader, ModalBody, Chip, Spinner } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { attendanceApi } from '../../services/api';
import type { RehearsalOverview, AttendanceRecord } from '../../types';
import { VoiceGroupList, useCollapsedVoices } from '../common/VoiceGroupList';
import type { VoiceGroupData } from '../common/VoiceGroupList';
import { useDateLocale } from '../../hooks/useDateLocale';
import { formatDateLong } from '../../utils/dateFormatting';

function isUnexpectedAbsence(record: AttendanceRecord): boolean {
  return !record.attended && record.plan !== 'DECLINED';
}

interface Props {
  rehearsal: RehearsalOverview;
  type: 'future' | 'past';
  isOpen: boolean;
  onClose: () => void;
  onMemberClick?: (member: AttendanceRecord) => void;
}

const NO_VOICE_KEY = '__no_voice__';

export function AttendanceDetailModal({ rehearsal, type, isOpen, onClose, onMemberClick }: Props) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [planFilter, setPlanFilter] = useState<'CONFIRMED' | 'DECLINED' | 'NONE' | null>(null);
  const [attendanceFilter, setAttendanceFilter] = useState<'PRESENT' | 'UNEXCUSED' | 'EXCUSED' | null>(null);
  const [loading, setLoading] = useState(false);
  const { collapsedVoices, toggle: toggleVoice, collapseAll } = useCollapsedVoices();
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const showPlanStatus = rehearsal.isOptional || type === 'future';

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setPlanFilter(null);
    setAttendanceFilter(null);
    collapseAll([]);
    attendanceApi.getRecords(rehearsal.id)
      .then((res) => {
        const data = res.data as AttendanceRecord[];
        setRecords(data);
        const voices = [...new Set(data.map((r) => r.choirVoice?.name).filter(Boolean) as string[])];
        const collapseKeys = data.some((r) => !r.choirVoice) ? [...voices, NO_VOICE_KEY] : voices;
        collapseAll(collapseKeys);
      })
      .catch(() => {
        setRecords([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, rehearsal.id]);

  const filteredRecords = showPlanStatus
    ? planFilter
      ? records.filter((r) => {
          if (planFilter === 'NONE') return !r.plan;
          return r.plan === planFilter;
        })
      : records
    : attendanceFilter
    ? records.filter((r) => {
        if (attendanceFilter === 'PRESENT') return r.attended;
        if (attendanceFilter === 'UNEXCUSED') return isUnexpectedAbsence(r);
        return !r.attended && r.plan === 'DECLINED';
      })
    : records;

  const noVoiceRecords = filteredRecords.filter((r) => !r.choirVoice);
  const voiceNames = [...new Set(filteredRecords.map((r) => r.choirVoice?.name).filter(Boolean) as string[])];

  const buildVoiceGroup = (voice: string, members: AttendanceRecord[], label?: string): VoiceGroupData => {
    const total = members.length;
    const confirmedCount = members.filter((m) => m.plan === 'CONFIRMED').length;
    const attendedCount = members.filter((m) => m.attended).length;
    const noChoiceCount = members.filter((m) => !m.plan).length;
    const absentCount = members.filter((m) => !m.attended).length;
    const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
    const primaryCount = showPlanStatus ? confirmedCount : attendedCount;
    const primaryLabel = showPlanStatus
      ? t('attendance_detail.label_confirmed')
      : t('attendance_detail.label_present');
    const secondaryCount = showPlanStatus ? noChoiceCount : absentCount;
    const secondaryLabel = showPlanStatus
      ? t('attendance_detail.label_no_response')
      : t('attendance_detail.label_absent');
    return {
      voice,
      label,
      headerRight: (
        <span className="flex flex-col items-start gap-0.5 text-xs font-normal sm:flex-row sm:items-center sm:gap-3">
          <span className="text-success-600">
            {primaryCount} {primaryLabel} ({pct(primaryCount)} %)
          </span>
          <span className="text-default-400">
            {secondaryCount} {secondaryLabel} ({pct(secondaryCount)} %)
          </span>
        </span>
      ),
      rows: members.map((m) => {
        const absent = isUnexpectedAbsence(m);
        return {
          key: m.id,
          content: (
            <div
              onClick={onMemberClick ? () => onMemberClick(m) : undefined}
              className={[
                'flex items-center justify-between px-4 py-2.5 text-sm',
                !showPlanStatus
                  ? m.attended
                    ? 'bg-success-50 text-success-800'
                    : absent
                    ? 'bg-danger-50 text-danger-800'
                    : 'bg-content1 text-default-500'
                  : m.plan === 'CONFIRMED'
                  ? 'bg-success-50 text-success-800'
                  : m.plan === 'DECLINED'
                  ? 'bg-danger-50 text-danger-800'
                  : 'bg-content1 text-default-500',
                onMemberClick ? 'cursor-pointer hover:opacity-75 transition-opacity' : '',
              ].filter(Boolean).join(' ')}
            >
              <span
                className={[
                  'font-medium inline-flex items-center gap-1',
                  onMemberClick ? 'text-primary' : '',
                ].filter(Boolean).join(' ')}
              >
                <span>{m.firstName} {m.lastName}</span>
                {onMemberClick && <MagnifyingGlassIcon className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />}
              </span>
              {!showPlanStatus ? (
                <span className="text-xs">
                  {m.attended
                    ? t('attendance_detail.row_present')
                    : m.plan === 'DECLINED'
                    ? t('attendance_detail.row_declined')
                    : t('attendance_detail.row_absent')}
                </span>
              ) : (
                <span
                  className={[
                    'text-xs font-medium',
                    m.plan === 'CONFIRMED'
                      ? 'text-success-700'
                      : m.plan === 'DECLINED'
                      ? 'text-danger-700'
                      : 'text-default-500',
                  ].join(' ')}
                >
                  {m.plan === 'CONFIRMED'
                    ? t('attendance_detail.row_plan_confirmed')
                    : m.plan === 'DECLINED'
                    ? t('attendance_detail.row_plan_declined')
                    : t('attendance_detail.row_plan_none')}
                </span>
              )}
            </div>
          ),
        };
      }),
    };
  };

  const voiceGroupData: VoiceGroupData[] = [
    ...voiceNames.map((voice) =>
      buildVoiceGroup(voice, filteredRecords.filter((r) => r.choirVoice?.name === voice)),
    ),
    ...(noVoiceRecords.length > 0
      ? [buildVoiceGroup(NO_VOICE_KEY, noVoiceRecords, t('attendance.no_voice_group'))]
      : []),
  ].filter((g) => g.rows.length > 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-0.5">
          <span>{rehearsal.title}</span>
          <span className="text-sm font-normal text-default-500">
            {formatDateLong(rehearsal.date, dateLocale)}
          </span>
        </ModalHeader>
        <ModalBody className="p-0">
          <div style={{ overflowY: 'auto', maxHeight: '70vh', padding: '0 1.5rem 1.5rem' }}>
            {loading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 mb-4">
                  {!showPlanStatus ? (
                    <>
                      <button type="button" onClick={() => setAttendanceFilter((prev) => (prev === 'PRESENT' ? null : 'PRESENT'))}>
                        <Chip color="success" variant={attendanceFilter === 'PRESENT' ? 'solid' : 'flat'} className="cursor-pointer">
                          {t('attendance_detail.present_chip', { count: records.filter((r) => r.attended).length })}
                        </Chip>
                      </button>
                      <button type="button" onClick={() => setAttendanceFilter((prev) => (prev === 'UNEXCUSED' ? null : 'UNEXCUSED'))}>
                        <Chip color="danger" variant={attendanceFilter === 'UNEXCUSED' ? 'solid' : 'flat'} className="cursor-pointer">
                          {t('attendance_detail.unexcused_chip', { count: records.filter((r) => isUnexpectedAbsence(r)).length })}
                        </Chip>
                      </button>
                      <button type="button" onClick={() => setAttendanceFilter((prev) => (prev === 'EXCUSED' ? null : 'EXCUSED'))}>
                        <Chip color="default" variant={attendanceFilter === 'EXCUSED' ? 'solid' : 'flat'} className="cursor-pointer">
                          {t('attendance_detail.excused_chip', { count: records.filter((r) => !r.attended && r.plan === 'DECLINED').length })}
                        </Chip>
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => setPlanFilter((prev) => (prev === 'CONFIRMED' ? null : 'CONFIRMED'))}>
                        <Chip color="success" variant={planFilter === 'CONFIRMED' ? 'solid' : 'flat'} className="cursor-pointer">
                          {t('attendance_detail.confirmed_chip', { count: records.filter((r) => r.plan === 'CONFIRMED').length })}
                        </Chip>
                      </button>
                      <button type="button" onClick={() => setPlanFilter((prev) => (prev === 'DECLINED' ? null : 'DECLINED'))}>
                        <Chip color="danger" variant={planFilter === 'DECLINED' ? 'solid' : 'flat'} className="cursor-pointer">
                          {t('attendance_detail.declined_chip', { count: records.filter((r) => r.plan === 'DECLINED').length })}
                        </Chip>
                      </button>
                      <button type="button" onClick={() => setPlanFilter((prev) => (prev === 'NONE' ? null : 'NONE'))}>
                        <Chip color="default" variant={planFilter === 'NONE' ? 'solid' : 'flat'} className="cursor-pointer">
                          {t('attendance_detail.no_response_chip', { count: records.filter((r) => !r.plan).length })}
                        </Chip>
                      </button>
                    </>
                  )}
                </div>
                <VoiceGroupList
                  groups={voiceGroupData}
                  collapsedVoices={collapsedVoices}
                  onToggle={toggleVoice}
                  emptyState={
                    <p className="text-default-400 text-center py-4">{t('detail_modal.no_member_data')}</p>
                  }
                />
              </>
            )}
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
