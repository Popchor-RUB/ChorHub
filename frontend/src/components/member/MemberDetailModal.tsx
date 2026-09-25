import { useEffect, useState } from 'react';
import { Modal, Spinner, Button } from '@heroui/react';
import { CheckIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { adminMembersApi } from '../../services/api';
import type { ChoirVoice, MemberRehearsalEntry } from '../../types';
import { useDateLocale } from '../../hooks/useDateLocale';
import { MemberRehearsalOverview } from './MemberRehearsalOverview';

interface MemberRef {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  choirVoice: ChoirVoice | null;
}

interface Props {
  member: MemberRef;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (memberId: string) => void;
}

export function MemberDetailModal({ member, isOpen, onClose, onDelete }: Props) {
  const [rehearsals, setRehearsals] = useState<MemberRehearsalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dateLocale = useDateLocale();

  useEffect(() => {
    if (!isOpen) {
      setEditMode(false);
      setShowAllUpcoming(false);
      setIsDeleteConfirmOpen(false);
      return;
    }
    setShowAllUpcoming(false);
    setLoading(true);
    adminMembersApi.rehearsals(member.id).then((res) => {
      setRehearsals(res.data as MemberRehearsalEntry[]);
      setLoading(false);
    });
  }, [isOpen, member.id]);

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      await adminMembersApi.delete(member.id);
      setIsDeleteConfirmOpen(false);
      onClose();
      onDelete?.(member.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
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
                {editMode && onDelete && (
                  <Button
                    isIconOnly
                    size="sm"
                    variant="danger-soft"
                    aria-label={t('detail_modal.delete_member')}
                    onPress={() => setIsDeleteConfirmOpen(true)}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="tertiary"
                  data-testid="member-detail-open-page"
                  onPress={() => {
                    onClose();
                    navigate(`/admin/mitglieder/${member.id}`);
                  }}
                >
                  {t('detail_modal.open_member_page')}
                </Button>
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

      <Modal.Backdrop isOpen={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header><Modal.Heading>{t('detail_modal.delete_member')}</Modal.Heading></Modal.Header>
            <Modal.Body>
            <p className="text-sm text-muted">{t('detail_modal.delete_confirm_prompt')}</p>
            </Modal.Body>
            <Modal.Footer>
            <Button variant="tertiary" onPress={() => setIsDeleteConfirmOpen(false)} isDisabled={deleting}>
              {t('detail_modal.delete_confirm_no')}
            </Button>
            <Button variant="danger" isPending={deleting} onPress={handleDeleteConfirm}>
              {({ isPending }) => <>{isPending && <Spinner color="current" size="sm" />}{t('detail_modal.delete_confirm_yes')}</>}
            </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}
