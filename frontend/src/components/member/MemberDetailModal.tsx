import { useEffect, useState } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Spinner, Button } from '@heroui/react';
import { CheckIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { adminMembersApi, attendanceApi } from '../../services/api';
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

  const cycleUpcomingPlan = (current: 'CONFIRMED' | 'DECLINED' | null): 'CONFIRMED' | 'DECLINED' | null => {
    if (current === 'CONFIRMED') return 'DECLINED';
    if (current === 'DECLINED') return null;
    return 'CONFIRMED';
  };

  const cycleOptionalPlan = (current: 'CONFIRMED' | 'DECLINED' | null): 'CONFIRMED' | 'DECLINED' | null => {
    if (current === 'CONFIRMED') return 'DECLINED';
    if (current === 'DECLINED') return null;
    return 'CONFIRMED';
  };

  const handleToggleUpcomingPlan = async (r: MemberRehearsalEntry) => {
    if (saving) return;
    const newResponse = r.isOptional ? cycleOptionalPlan(r.plan) : cycleUpcomingPlan(r.plan);
    setRehearsals((prev) =>
      prev.map((x) => (x.id === r.id ? { ...x, plan: newResponse } : x)),
    );
    setSaving(r.id);
    try {
      await adminMembersApi.setAttendancePlan(member.id, r.id, newResponse);
    } catch {
      setRehearsals((prev) =>
        prev.map((x) => (x.id === r.id ? { ...x, plan: r.plan } : x)),
      );
    } finally {
      setSaving(null);
    }
  };

  const handleToggleAttendanceRecord = async (r: MemberRehearsalEntry) => {
    if (saving) return;
    const nextAttended = !r.attended;
    setRehearsals((prev) =>
      prev.map((x) => (x.id === r.id ? { ...x, attended: nextAttended } : x)),
    );
    setSaving(r.id);
    try {
      await attendanceApi.setRecord(r.id, member.id, nextAttended);
    } catch {
      setRehearsals((prev) =>
        prev.map((x) => (x.id === r.id ? { ...x, attended: r.attended } : x)),
      );
    } finally {
      setSaving(null);
    }
  };

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
      <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <span>
                {member.firstName} {member.lastName}
              </span>
              <span className="text-sm font-normal text-default-500">
                {member.choirVoice?.name ?? '—'}{member.email ? ` · ${member.email}` : ''}
              </span>
            </div>
            {!loading && (
              <div className="mt-0.5 mr-2 flex shrink-0 items-center gap-1.5">
                {editMode && onDelete && (
                  <Button
                    isIconOnly
                    size="sm"
                    color="danger"
                    variant="flat"
                    aria-label={t('detail_modal.delete_member')}
                    title={t('detail_modal.delete_member')}
                    onPress={() => setIsDeleteConfirmOpen(true)}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="flat"
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
                  variant={editMode ? 'solid' : 'flat'}
                  color={editMode ? 'primary' : 'default'}
                  aria-label={editMode ? t('detail_modal.edit_mode_done') : t('detail_modal.edit_mode_toggle')}
                  title={editMode ? t('detail_modal.edit_mode_done') : t('detail_modal.edit_mode_toggle')}
                  onPress={() => setEditMode((v) => !v)}
                >
                  {editMode ? <CheckIcon className="h-4 w-4" /> : <PencilSquareIcon className="h-4 w-4" />}
                </Button>
              </div>
            )}
          </ModalHeader>
          <ModalBody className="pb-6">
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
                savingId={saving}
                showAllUpcoming={showAllUpcoming}
                setShowAllUpcoming={setShowAllUpcoming}
                onToggleUpcomingPlan={handleToggleUpcomingPlan}
                onTogglePastAttendance={handleToggleAttendanceRecord}
                showEditToggle={false}
              />
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} size="sm">
        <ModalContent>
          <ModalHeader>{t('detail_modal.delete_member')}</ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-600">{t('detail_modal.delete_confirm_prompt')}</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setIsDeleteConfirmOpen(false)} isDisabled={deleting}>
              {t('detail_modal.delete_confirm_no')}
            </Button>
            <Button color="danger" isLoading={deleting} onPress={handleDeleteConfirm}>
              {t('detail_modal.delete_confirm_yes')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
