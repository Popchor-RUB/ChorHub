import { useEffect, useState } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, Chip, Spinner, Button } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { adminMembersApi } from '../../services/api';
import type { ChoirVoice, MemberRehearsalEntry } from '../../types';
import { useDateLocale } from '../../hooks/useDateLocale';
import { formatDateMedium } from '../../utils/dateFormatting';

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
  const [saving, setSaving] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { t } = useTranslation();
  const dateLocale = useDateLocale();

  useEffect(() => {
    if (!isOpen) {
      setEditMode(false);
      setConfirmingDelete(false);
      return;
    }
    setLoading(true);
    adminMembersApi.rehearsals(member.id).then((res) => {
      setRehearsals(res.data as MemberRehearsalEntry[]);
      setLoading(false);
    });
  }, [isOpen, member.id]);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const past = rehearsals.filter((r) => new Date(r.date) < startOfToday).reverse();
  const upcoming = rehearsals.filter((r) => new Date(r.date) >= startOfToday);
  const countablePast = past.filter((r) => !r.isOptional);
  const countableUpcoming = upcoming.filter((r) => !r.isOptional);

  const unexcusedCount = countablePast.filter((r) => !r.attended && r.plan !== 'DECLINED').length;
  const excusedCount = countablePast.filter((r) => !r.attended && r.plan === 'DECLINED').length;

  const cycleAbsencePlan = (current: 'CONFIRMED' | 'DECLINED' | null): 'DECLINED' | null =>
    current === 'DECLINED' ? null : 'DECLINED';

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

  const handleTogglePlan = async (r: MemberRehearsalEntry, isPast: boolean) => {
    if (saving) return;
    const newResponse = r.isOptional
      ? cycleOptionalPlan(r.plan)
      : isPast
      ? cycleAbsencePlan(r.plan)
      : cycleUpcomingPlan(r.plan);
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

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      await adminMembersApi.delete(member.id);
      onClose();
      onDelete?.(member.id);
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  return (
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
            <div className="flex items-center gap-2 shrink-0 mt-0.5">
              {editMode && onDelete && (
                confirmingDelete ? (
                  <>
                    <span className="text-xs text-danger font-medium">{t('detail_modal.delete_confirm_prompt')}</span>
                    <Button
                      size="sm"
                      color="danger"
                      variant="solid"
                      isLoading={deleting}
                      onPress={handleDeleteConfirm}
                    >
                      {t('detail_modal.delete_confirm_yes')}
                    </Button>
                    <Button
                      size="sm"
                      variant="flat"
                      onPress={() => setConfirmingDelete(false)}
                      isDisabled={deleting}
                    >
                      {t('detail_modal.delete_confirm_no')}
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    color="danger"
                    variant="flat"
                    onPress={() => setConfirmingDelete(true)}
                  >
                    {t('detail_modal.delete_member')}
                  </Button>
                )
              )}
              <Button
                size="sm"
                variant={editMode ? 'solid' : 'flat'}
                color={editMode ? 'primary' : 'default'}
                onPress={() => { setEditMode((v) => !v); setConfirmingDelete(false); }}
              >
                {editMode ? t('detail_modal.edit_mode_done') : t('detail_modal.edit_mode_toggle')}
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
            <>
              <div className="flex flex-wrap gap-2 mb-4">
                <Chip color="success" variant="flat">
                  {t('detail_modal.present_count', { count: countablePast.filter((r) => r.attended).length })}
                </Chip>
                <Chip color="danger" variant="flat">
                  {t('detail_modal.unexcused_count', { count: unexcusedCount })}
                </Chip>
                <Chip color="default" variant="flat">
                  {t('detail_modal.excused_count', { count: excusedCount })}
                </Chip>
                {countableUpcoming.length > 0 && (
                  <Chip color="primary" variant="flat">
                    {t('detail_modal.confirmed_upcoming', {
                      confirmed: countableUpcoming.filter((r) => r.plan === 'CONFIRMED').length,
                      total: countableUpcoming.length,
                    })}
                  </Chip>
                )}
              </div>

              {upcoming.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-semibold text-default-400 uppercase tracking-wide mb-2">
                    {t('detail_modal.upcoming_rehearsals')}
                  </p>
                  <div className="flex flex-col gap-1">
                    {upcoming.map((r) => {
                      const isSaving = saving === r.id;
                      const isToggleable = editMode;
                      return (
                        <div
                          key={r.id}
                          onClick={isToggleable ? () => handleTogglePlan(r, false) : undefined}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm bg-default-50 ${
                            isToggleable ? 'cursor-pointer hover:opacity-75 transition-opacity' : ''
                          }`}
                        >
                          <span className="font-medium text-default-700">
                            {formatDateMedium(r.date, dateLocale)} – {r.title}
                            {r.isOptional && (
                              <span className="ml-2 text-[11px] uppercase tracking-wide text-warning-700">
                                {t('rehearsals.optional_badge')}
                              </span>
                            )}
                          </span>
                          <span className="text-xs text-default-500 flex items-center gap-1">
                            {isSaving ? (
                              <Spinner size="sm" />
                            ) : (
                              <>
                                {r.plan === 'CONFIRMED'
                                  ? t('detail_modal.plan_confirmed')
                                  : r.plan === 'DECLINED'
                                  ? t('detail_modal.plan_declined')
                                  : t('detail_modal.plan_none')}
                                {isToggleable && <span className="opacity-50 ml-1">⇄</span>}
                              </>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {past.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-default-400 uppercase tracking-wide mb-2">
                    {t('detail_modal.past_rehearsals')}
                  </p>
                  <div className="flex flex-col gap-1">
                    {past.map((r) => {
                      const unexcused = !r.isOptional && !r.attended && r.plan !== 'DECLINED';
                      const isToggleable = editMode && (r.isOptional || !r.attended);
                      const isSaving = saving === r.id;
                      return (
                        <div
                          key={r.id}
                          onClick={isToggleable ? () => handleTogglePlan(r, true) : undefined}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                            r.isOptional
                              ? 'bg-default-50 text-default-500'
                              : r.attended
                              ? 'bg-success-50 text-success-800'
                              : unexcused
                              ? 'bg-danger-50 text-danger-800'
                              : 'bg-default-50 text-default-500'
                          } ${isToggleable ? 'cursor-pointer hover:opacity-75 transition-opacity' : ''}`}
                        >
                          <span className="font-medium">
                            {formatDateMedium(r.date, dateLocale)} – {r.title}
                            {r.isOptional && (
                              <span className="ml-2 text-[11px] uppercase tracking-wide text-warning-700">
                                {t('rehearsals.optional_badge')}
                              </span>
                            )}
                          </span>
                          <span className="text-xs flex items-center gap-1">
                            {isSaving ? (
                              <Spinner size="sm" />
                            ) : (
                              <>
                                {r.isOptional
                                  ? r.plan === 'CONFIRMED'
                                    ? t('detail_modal.plan_confirmed')
                                    : r.plan === 'DECLINED'
                                    ? t('detail_modal.plan_declined')
                                    : t('detail_modal.plan_none')
                                  : r.attended
                                  ? t('detail_modal.attended')
                                  : r.plan === 'DECLINED'
                                  ? t('detail_modal.excused_short')
                                  : t('detail_modal.unexcused_short')}
                                {isToggleable && (
                                  <span className="opacity-50 ml-1">⇄</span>
                                )}
                              </>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {rehearsals.length === 0 && (
                <p className="text-default-400 text-center py-4">{t('detail_modal.no_rehearsals')}</p>
              )}
            </>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
