import { useEffect, useState } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, Chip, Spinner } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { adminMembersApi } from '../../services/api';
import type { MemberOverview, MemberRehearsalEntry } from '../../types';
import { useDateLocale } from '../../hooks/useDateLocale';
import { formatDateMedium } from '../../utils/dateFormatting';

interface Props {
  member: MemberOverview;
  isOpen: boolean;
  onClose: () => void;
}

export function MemberDetailModal({ member, isOpen, onClose }: Props) {
  const [rehearsals, setRehearsals] = useState<MemberRehearsalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  const dateLocale = useDateLocale();

  useEffect(() => {
    if (!isOpen) return;
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-0.5">
          <span>
            {member.firstName} {member.lastName}
          </span>
          <span className="text-sm font-normal text-default-500">
            {member.choirVoice?.name ?? '—'} · {member.email}
          </span>
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
                  {t('detail_modal.present_count', { count: past.filter((r) => r.attended).length })}
                </Chip>
                <Chip color="danger" variant="flat">
                  {t('detail_modal.unexcused_count', { count: member.unexcusedAbsenceCount })}
                </Chip>
                <Chip color="default" variant="flat">
                  {t('detail_modal.excused_count', { count: past.filter((r) => !r.attended && r.plan === 'DECLINED').length })}
                </Chip>
                {upcoming.length > 0 && (
                  <Chip color="primary" variant="flat">
                    {t('detail_modal.confirmed_upcoming', {
                      confirmed: upcoming.filter((r) => r.plan === 'CONFIRMED').length,
                      total: upcoming.length,
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
                    {upcoming.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between px-3 py-2 rounded-lg text-sm bg-default-50"
                      >
                        <span className="font-medium text-default-700">
                          {formatDateMedium(r.date, dateLocale)} – {r.title}
                        </span>
                        <span className="text-xs text-default-500">
                          {r.plan === 'CONFIRMED'
                            ? t('detail_modal.plan_confirmed')
                            : r.plan === 'DECLINED'
                            ? t('detail_modal.plan_declined')
                            : t('detail_modal.plan_none')}
                        </span>
                      </div>
                    ))}
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
                      const unexcused = !r.attended && r.plan !== 'DECLINED';
                      return (
                        <div
                          key={r.id}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                            r.attended
                              ? 'bg-success-50 text-success-800'
                              : unexcused
                              ? 'bg-danger-50 text-danger-800'
                              : 'bg-default-50 text-default-500'
                          }`}
                        >
                          <span className="font-medium">
                            {formatDateMedium(r.date, dateLocale)} – {r.title}
                          </span>
                          <span className="text-xs">
                            {r.attended
                              ? t('detail_modal.attended')
                              : r.plan === 'DECLINED'
                              ? t('detail_modal.excused_short')
                              : t('detail_modal.unexcused_short')}
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
