import { useEffect, useState } from 'react';
import axios from 'axios';
import { Button, Modal, Spinner } from '@heroui/react';
import { CheckIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { voiceAdminAttendanceApi } from '../../services/api';
import type { MemberRehearsalEntry, VoiceAttendanceRecord } from '../../types';
import { useDateLocale } from '../../hooks/useDateLocale';
import { MemberRehearsalOverview } from './MemberRehearsalOverview';
import { MemberCommentEditor } from './MemberCommentEditor';

type Props = {
  member: VoiceAttendanceRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onAccessRevoked: () => void;
  onCommentChanged: (memberId: string, comment: string | null) => void;
};

export function VoiceAdminMemberDetailModal({ member, isOpen, onClose, onAccessRevoked, onCommentChanged }: Props) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const [rehearsals, setRehearsals] = useState<MemberRehearsalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    if (!isOpen || !member) return;

    let active = true;
    voiceAdminAttendanceApi.getMemberRehearsals(member.id)
      .then((response) => { if (active) setRehearsals(response.data); })
      .catch((error: unknown) => {
        if (!active) return;
        if (axios.isAxiosError(error) && error.response?.status === 403) onAccessRevoked();
        else setLoadError(true);
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [isOpen, member, onAccessRevoked]);

  const saveAttendancePlan = async (memberId: string, rehearsalId: string, response: 'CONFIRMED' | 'DECLINED' | null) => {
    try {
      await voiceAdminAttendanceApi.setMemberAttendancePlan(memberId, rehearsalId, response);
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 403) onAccessRevoked();
      throw error;
    }
  };

  const saveAttendanceRecord = async (memberId: string, rehearsalId: string, attended: boolean) => {
    try {
      await voiceAdminAttendanceApi.setRecord(rehearsalId, memberId, attended);
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 403) onAccessRevoked();
      throw error;
    }
  };

  const handleClose = () => {
    setEditMode(false);
    setSaveError(false);
    onClose();
  };

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <Modal.Container size="lg" scroll="inside">
        <Modal.Dialog data-testid="voice-admin-member-detail">
          <Modal.CloseTrigger />
          <Modal.Header className="flex items-start justify-between gap-2">
            <Modal.Heading className="flex flex-col gap-0.5">
              <span>{member ? `${member.firstName} ${member.lastName}` : ''}</span>
              <span className="text-sm font-normal text-muted">{member?.choirVoice?.name ?? '—'}</span>
            </Modal.Heading>
            {!loading && !loadError && member && (
              <div className="flex items-center gap-1.5">
                <MemberCommentEditor
                  comment={member.internalComment}
                  onSave={async (comment) => {
                    try {
                      const response = await voiceAdminAttendanceApi.setMemberComment(member.id, comment);
                      onCommentChanged(member.id, response.data.comment);
                    } catch (error: unknown) {
                      if (axios.isAxiosError(error) && error.response?.status === 403) onAccessRevoked();
                      throw error;
                    }
                  }}
                />
                <Button
                  isIconOnly
                  size="sm"
                  variant={editMode ? 'primary' : 'tertiary'}
                  aria-label={editMode ? t('detail_modal.edit_mode_done') : t('detail_modal.edit_mode_toggle')}
                  data-testid="voice-admin-member-edit-mode-toggle"
                  onPress={() => setEditMode((current) => !current)}
                >
                  {editMode ? <CheckIcon className="h-4 w-4" /> : <PencilSquareIcon className="h-4 w-4" />}
                </Button>
              </div>
            )}
          </Modal.Header>
          <Modal.Body className="pb-6">
            {loading ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : loadError ? (
              <p className="text-danger text-sm">{t('common.error_generic')}</p>
            ) : member ? (
              <MemberRehearsalOverview
                rehearsals={rehearsals}
                dateLocale={dateLocale}
                editMode={editMode}
                setEditMode={setEditMode}
                memberId={member.id}
                setRehearsals={setRehearsals}
                savingId={savingId}
                setSavingId={setSavingId}
                showAllUpcoming={showAllUpcoming}
                setShowAllUpcoming={setShowAllUpcoming}
                showEditToggle={false}
                testIdPrefix="voice-admin-member"
                onSaveError={() => setSaveError(true)}
                saveAttendancePlan={saveAttendancePlan}
                saveAttendanceRecord={saveAttendanceRecord}
              />
            ) : null}
            {saveError && <p className="mt-3 text-danger text-sm">{t('attendance.save_failed')}</p>}
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
