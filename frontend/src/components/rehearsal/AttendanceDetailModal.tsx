import { useEffect, useState } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, Chip, Spinner } from '@heroui/react';
import { attendanceApi } from '../../services/api';
import type { RehearsalOverview, AttendanceRecord } from '../../types';
import { VoiceGroupList, useCollapsedVoices } from '../common/VoiceGroupList';
import type { VoiceGroupData } from '../common/VoiceGroupList';
import { formatDateLong } from '../../utils/dateFormatting';

function isUnexpectedAbsence(record: AttendanceRecord): boolean {
  return !record.attended && record.plan !== 'DECLINED';
}

interface Props {
  rehearsal: RehearsalOverview;
  type: 'future' | 'past';
  isOpen: boolean;
  onClose: () => void;
}

export function AttendanceDetailModal({ rehearsal, type, isOpen, onClose }: Props) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const { collapsedVoices, toggle: toggleVoice, collapseAll } = useCollapsedVoices();

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    collapseAll([]);
    attendanceApi.getRecords(rehearsal.id).then((res) => {
      const data = res.data as AttendanceRecord[];
      setRecords(data);
      const voices = [...new Set(data.map((r) => r.choirVoice?.name).filter(Boolean) as string[])];
      collapseAll(voices);
      setLoading(false);
    });
  }, [isOpen, rehearsal.id]);

  const voiceNames = [...new Set(records.map((r) => r.choirVoice?.name).filter(Boolean) as string[])];
  const voiceGroupData: VoiceGroupData[] = voiceNames
    .map((voice) => {
      const members = records.filter((r) => r.choirVoice?.name === voice);
      const total = members.length;
      const confirmedCount = members.filter((m) => m.plan === 'CONFIRMED').length;
      const attendedCount = members.filter((m) => m.attended).length;
      const noChoiceCount = members.filter((m) => !m.plan).length;
      const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
      const primaryCount = type === 'future' ? confirmedCount : attendedCount;
      const primaryLabel = type === 'future' ? 'zugesagt' : 'anwesend';
      return {
        voice,
        headerRight: (
          <span className="flex items-center gap-3 text-xs font-normal">
            <span className="text-success-600">
              {primaryCount} {primaryLabel} ({pct(primaryCount)} %)
            </span>
            <span className="text-default-400">
              {noChoiceCount} keine Angabe ({pct(noChoiceCount)} %)
            </span>
          </span>
        ),
        rows: members.map((m) => {
          const absent = isUnexpectedAbsence(m);
          return {
            key: m.id,
            content: (
              <div
                className={[
                  'flex items-center justify-between px-4 py-2.5 text-sm',
                  type === 'past'
                    ? m.attended
                      ? 'bg-success-50 text-success-800'
                      : absent
                      ? 'bg-danger-50 text-danger-800'
                      : 'bg-content1 text-default-500'
                    : 'bg-content1',
                ].filter(Boolean).join(' ')}
              >
                <span className="font-medium">{m.lastName}, {m.firstName}</span>
                {type === 'past' ? (
                  <span className="text-xs">
                    {m.attended ? '✓ anwesend' : m.plan === 'DECLINED' ? 'abgesagt' : '✗ gefehlt'}
                  </span>
                ) : (
                  <span className="text-xs">
                    {m.plan === 'CONFIRMED' ? '✓ zugesagt' : m.plan === 'DECLINED' ? '✗ abgesagt' : '– keine Angabe'}
                  </span>
                )}
              </div>
            ),
          };
        }),
      };
    })
    .filter((g) => g.rows.length > 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-0.5">
          <span>{rehearsal.title}</span>
          <span className="text-sm font-normal text-default-500">
            {formatDateLong(rehearsal.date)}
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
                  {type === 'past' ? (
                    <>
                      <Chip color="success" variant="flat">
                        {records.filter((r) => r.attended).length} anwesend
                      </Chip>
                      <Chip color="danger" variant="flat">
                        {records.filter((r) => isUnexpectedAbsence(r)).length} unentschuldigt gefehlt
                      </Chip>
                      <Chip color="default" variant="flat">
                        {records.filter((r) => !r.attended && r.plan === 'DECLINED').length} entschuldigt
                      </Chip>
                    </>
                  ) : (
                    <>
                      <Chip color="success" variant="flat">
                        {records.filter((r) => r.plan === 'CONFIRMED').length} zugesagt
                      </Chip>
                      <Chip color="danger" variant="flat">
                        {records.filter((r) => r.plan === 'DECLINED').length} abgesagt
                      </Chip>
                      <Chip color="default" variant="flat">
                        {records.filter((r) => !r.plan).length} keine Angabe
                      </Chip>
                    </>
                  )}
                </div>
                <VoiceGroupList
                  groups={voiceGroupData}
                  collapsedVoices={collapsedVoices}
                  onToggle={toggleVoice}
                  emptyState={
                    <p className="text-default-400 text-center py-4">Keine Mitgliederdaten.</p>
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
