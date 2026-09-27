import { useEffect, useState } from 'react';
import { Modal, Spinner, Button } from '@heroui/react';
import { CheckIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { adminMembersApi } from '../../services/api';
import type { ChoirVoice, MemberRehearsalEntry } from '../../types';
import { useDateLocale } from '../../hooks/useDateLocale';
import { MemberRehearsalOverview } from './MemberRehearsalOverview';
import { MemberStatusActions } from './MemberStatusActions';
import { MemberCommentEditor } from './MemberCommentEditor';

interface MemberRef {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  choirVoice: ChoirVoice | null;
  isDisabled?: boolean;
  disabledAt?: string | null;
  disableReason?: string | null;
  internalComment?: string | null;
}

interface Props {
  member: MemberRef;
  isOpen: boolean;
  onClose: () => void;
  onStatusChanged?: (memberId: string) => void;
  showComment?: boolean;
  onCommentChanged?: (memberId: string, comment: string | null) => void;
}

export function MemberDetailModal({ member, isOpen, onClose, onStatusChanged, showComment = false, onCommentChanged }: Props) {
  const [rehearsals, setRehearsals] = useState<MemberRehearsalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dateLocale = useDateLocale();

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    void Promise.resolve().then(() => {
      setLoading(true);
      return adminMembersApi.rehearsals(member.id);
    }).then((res) => {
      setRehearsals(res.data as MemberRehearsalEntry[]);
    }).finally(() => setLoading(false));
  }, [isOpen, member.id]);

  const handleClose = () => {
    setEditMode(false);
    setShowAllUpcoming(false);
    onClose();
  };

  return (
    <>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header className="flex items-start justify-between gap-2">
              <Modal.Heading className="flex flex-col gap-0.5">
              <span>
                {member.firstName} {member.lastName}
              </span>
              <span className="text-sm font-normal text-muted">
                {member.choirVoice?.name ?? '—'}{member.email ? ` · ${member.email}` : ''}
              </span>
              </Modal.Heading>
            {!loading && (
              <div className="mt-0.5 mr-2 flex shrink-0 items-center gap-1.5">
                {onStatusChanged && (
                  <MemberStatusActions
                    memberId={member.id}
                    status={{ isDisabled: member.isDisabled ?? false, disabledAt: member.disabledAt ?? null, disableReason: member.disableReason ?? null }}
                    onUpdated={() => onStatusChanged(member.id)}
                  />
                )}
                <Button
                  size="sm"
                  variant="tertiary"
                  data-testid="member-detail-open-page"
                  onPress={() => {
                    handleClose();
                    navigate(`/admin/mitglieder/${member.id}`);
                  }}
                >
                  {t('detail_modal.open_member_page')}
                </Button>
                {showComment && (
                  <MemberCommentEditor
                    comment={member.internalComment}
                    onSave={async (comment) => {
                      const response = await adminMembersApi.setComment(member.id, comment);
                      onCommentChanged?.(member.id, response.data.comment);
                    }}
                  />
                )}
                <Button
                  isIconOnly
                  size="sm"
                  variant={editMode ? 'primary' : 'tertiary'}
                  aria-label={editMode ? t('detail_modal.edit_mode_done') : t('detail_modal.edit_mode_toggle')}
                  onPress={() => setEditMode((v) => !v)}
                >
                  {editMode ? <CheckIcon className="h-4 w-4" /> : <PencilSquareIcon className="h-4 w-4" />}
                </Button>
              </div>
            )}
            </Modal.Header>
            <Modal.Body className="pb-6">
            {loading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : (
              <MemberRehearsalOverview
                rehearsals={rehearsals}
                dateLocale={dateLocale}
                editMode={editMode}
                setEditMode={setEditMode}
                memberId={member.id}
                setRehearsals={setRehearsals}
                savingId={saving}
                setSavingId={setSaving}
                showAllUpcoming={showAllUpcoming}
                setShowAllUpcoming={setShowAllUpcoming}
                showEditToggle={false}
              />
            )}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

    </>
  );
}
