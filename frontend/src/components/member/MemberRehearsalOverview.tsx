import type { Dispatch, SetStateAction } from 'react';
import { CheckIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { Button, Chip, Spinner } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { adminMembersApi, attendanceApi } from '../../services/api';
import type { MemberRehearsalEntry } from '../../types';
import { formatDateMedium } from '../../utils/dateFormatting';

type Props = {
  rehearsals: MemberRehearsalEntry[];
  dateLocale: string;
  editMode: boolean;
  setEditMode: (next: boolean | ((prev: boolean) => boolean)) => void;
  memberId: string;
  setRehearsals: Dispatch<SetStateAction<MemberRehearsalEntry[]>>;
  savingId: string | null;
  setSavingId: Dispatch<SetStateAction<string | null>>;
  showAllUpcoming: boolean;
  setShowAllUpcoming: (next: boolean) => void;
  onSaveError?: () => void;
  title?: string;
  className?: string;
  testIdPrefix?: string;
  showEditToggle?: boolean;
  saveAttendancePlan?: (memberId: string, rehearsalId: string, response: 'CONFIRMED' | 'DECLINED' | null) => Promise<unknown>;
  saveAttendanceRecord?: (memberId: string, rehearsalId: string, attended: boolean) => Promise<unknown>;
  loadRehearsals?: (memberId: string) => Promise<{ data: MemberRehearsalEntry[] }>;
};

export function MemberRehearsalOverview({
  rehearsals,
  dateLocale,
  editMode,
  setEditMode,
  memberId,
  setRehearsals,
  savingId,
  setSavingId,
  showAllUpcoming,
  setShowAllUpcoming,
  onSaveError,
  title,
  className,
  testIdPrefix,
  showEditToggle = true,
  saveAttendancePlan,
  saveAttendanceRecord,
  loadRehearsals = adminMembersApi.rehearsals,
}: Props) {
  const { t } = useTranslation();
  const cyclePlan = (current: 'CONFIRMED' | 'DECLINED' | null): 'CONFIRMED' | 'DECLINED' | null => {
    if (current === 'CONFIRMED') return 'DECLINED';
    if (current === 'DECLINED') return null;
    return 'CONFIRMED';
  };

  const handleToggleUpcomingPlan = async (rehearsal: MemberRehearsalEntry) => {
    if (savingId) return;
    const nextPlan = cyclePlan(rehearsal.plan);

    setRehearsals((prev) => prev.map((x) => (x.id === rehearsal.id ? { ...x, plan: nextPlan } : x)));
    setSavingId(rehearsal.id);
    try {
      await (saveAttendancePlan ?? adminMembersApi.setAttendancePlan)(memberId, rehearsal.id, nextPlan);
    } catch {
      setRehearsals((prev) => prev.map((x) => (x.id === rehearsal.id ? { ...x, plan: rehearsal.plan } : x)));
      onSaveError?.();
    } finally {
      setSavingId(null);
    }
  };

  const getNextPastState = (rehearsal: MemberRehearsalEntry): Pick<MemberRehearsalEntry, 'attended' | 'plan'> => {
    if (rehearsal.attended) return { attended: false, plan: 'DECLINED' };
    if (rehearsal.plan === 'DECLINED') return { attended: false, plan: 'CONFIRMED' };
    return { attended: true, plan: null };
  };

  const handleTogglePastAttendance = async (rehearsal: MemberRehearsalEntry) => {
    if (savingId) return;
    const nextState = rehearsal.isOptional
      ? { attended: rehearsal.attended, plan: cyclePlan(rehearsal.plan) }
      : getNextPastState(rehearsal);

    setRehearsals((prev) =>
      prev.map((x) => (x.id === rehearsal.id ? { ...x, attended: nextState.attended, plan: nextState.plan } : x)),
    );
    setSavingId(rehearsal.id);
    try {
      if (rehearsal.isOptional) {
        await (saveAttendancePlan ?? adminMembersApi.setAttendancePlan)(memberId, rehearsal.id, nextState.plan);
      } else {
        await Promise.all([
          (saveAttendanceRecord ?? ((id, rehearsalId, attended) => attendanceApi.setRecord(rehearsalId, id, attended)))(memberId, rehearsal.id, nextState.attended),
          (saveAttendancePlan ?? adminMembersApi.setAttendancePlan)(memberId, rehearsal.id, nextState.plan),
        ]);
      }
      // The first or last attendance record can change whether an absence counts.
      // Reload the backend classification instead of duplicating its rules here.
      try {
        const { data } = await loadRehearsals(memberId);
        setRehearsals(data);
      } catch {
        onSaveError?.();
      }
    } catch {
      setRehearsals((prev) =>
        prev.map((x) => (x.id === rehearsal.id ? { ...x, attended: rehearsal.attended, plan: rehearsal.plan } : x)),
      );
      onSaveError?.();
    } finally {
      setSavingId(null);
    }
  };

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const past = rehearsals.filter((r) => new Date(r.date) < startOfToday).reverse();
  const upcoming = rehearsals.filter((r) => new Date(r.date) >= startOfToday);
  const visibleUpcoming = showAllUpcoming ? upcoming : upcoming.slice(0, 5);
  const hasHiddenUpcoming = upcoming.length > visibleUpcoming.length;
  const countablePast = past.filter((r) => !r.isOptional);
  const countableUpcoming = upcoming.filter((r) => !r.isOptional);

  const unexcusedCount = rehearsals.filter((r) => r.isUnexcusedAbsence).length;
  const excusedCount = countablePast.filter((r) => !r.attended && r.plan === 'DECLINED').length;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {title ? <h2 className="text-lg font-semibold">{title}</h2> : <span />}
        {showEditToggle && (
          <Button
            isIconOnly
            size="sm"
            variant={editMode ? 'primary' : 'tertiary'}
            aria-label={editMode ? t('detail_modal.edit_mode_done') : t('detail_modal.edit_mode_toggle')}
            onPress={() => setEditMode((v) => !v)}
            data-testid={testIdPrefix ? `${testIdPrefix}-edit-mode-toggle` : undefined}
          >
            {editMode ? <CheckIcon className="h-4 w-4" /> : <PencilSquareIcon className="h-4 w-4" />}
          </Button>
        )}
      </div>

      <div className="mb-4 mt-4 flex flex-wrap gap-2">
        <Chip className='bg-success-soft text-success-soft-foreground'>
          {t('detail_modal.present_count', { count: countablePast.filter((r) => r.attended).length })}
        </Chip>
        <Chip className='bg-danger-soft text-danger-soft-foreground'>
          {t('detail_modal.unexcused_count', { count: unexcusedCount })}
        </Chip>
        <Chip>
          {t('detail_modal.excused_count', { count: excusedCount })}
        </Chip>
        {countableUpcoming.length > 0 && (
          <Chip className='bg-accent-soft text-accent-soft-foreground'>
            {t('detail_modal.confirmed_upcoming', {
              confirmed: countableUpcoming.filter((r) => r.plan === 'CONFIRMED').length,
              total: countableUpcoming.length,
            })}
          </Chip>
        )}
      </div>

      {upcoming.length > 0 && (
        <div className="mb-5" data-testid={testIdPrefix ? `${testIdPrefix}-upcoming-section` : undefined}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            {t('detail_modal.upcoming_rehearsals')}
          </p>
          <div className="flex flex-col gap-1">
            {visibleUpcoming.map((r) => {
              const isSaving = savingId === r.id;
              const rowClassName = r.plan === 'CONFIRMED'
                ? 'bg-success-soft text-success-soft-foreground'
                : r.plan === 'DECLINED'
                ? 'bg-danger-soft text-danger-soft-foreground'
                : 'bg-surface-secondary text-muted';

              return (
                <div
                  key={r.id}
                  data-testid={testIdPrefix ? `${testIdPrefix}-upcoming-row-${r.id}` : undefined}
                  onClick={editMode ? () => void handleToggleUpcomingPlan(r) : undefined}
                  className={`flex flex-col items-start gap-1 rounded-lg px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between ${rowClassName} ${editMode ? 'cursor-pointer transition-opacity hover:opacity-75' : ''}`}
                >
                  <span className="font-medium">
                    {formatDateMedium(r.date, dateLocale)} - {r.title}
                    {r.isOptional && (
                      <span className="ml-2 text-[11px] uppercase tracking-wide text-warning-soft-foreground">
                        {t('rehearsals.optional_badge')}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1 text-xs sm:shrink-0">
                    {isSaving ? (
                      <Spinner size="sm" />
                    ) : (
                      <>
                        {r.plan === 'CONFIRMED'
                          ? t('detail_modal.plan_confirmed')
                          : r.plan === 'DECLINED'
                          ? t('detail_modal.plan_declined')
                          : t('detail_modal.plan_none')}
                        {editMode && <span className="ml-1 opacity-50">⇄</span>}
                      </>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          {!showAllUpcoming && hasHiddenUpcoming && (
            <div className="mt-3 flex justify-center">
              <Button onPress={() => setShowAllUpcoming(true)}>
                {t('rehearsals.show_all')}
              </Button>
            </div>
          )}
        </div>
      )}

      {past.length > 0 && (
        <div data-testid={testIdPrefix ? `${testIdPrefix}-past-section` : undefined}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            {t('detail_modal.past_rehearsals')}
          </p>
          <div className="flex flex-col gap-1">
            {past.map((r) => {
              const unexcused = r.isUnexcusedAbsence;
              const isSaving = savingId === r.id;
              const rowClassName = r.isOptional
                ? 'bg-surface-secondary text-muted'
                : r.attended
                ? 'bg-success-soft text-success-soft-foreground'
                : unexcused
                ? 'bg-danger-soft text-danger-soft-foreground'
                : 'bg-surface-secondary text-muted';

              return (
                <div
                  key={r.id}
                  data-testid={testIdPrefix ? `${testIdPrefix}-past-row-${r.id}` : undefined}
                  onClick={editMode ? () => void handleTogglePastAttendance(r) : undefined}
                  className={`flex flex-col items-start gap-1 rounded-lg px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between ${rowClassName} ${editMode ? 'cursor-pointer transition-opacity hover:opacity-75' : ''}`}
                >
                  <span className="font-medium">
                    {formatDateMedium(r.date, dateLocale)} - {r.title}
                    {r.isOptional && (
                      <span className="ml-2 text-[11px] uppercase tracking-wide text-warning-soft-foreground">
                        {t('rehearsals.optional_badge')}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1 text-xs sm:shrink-0">
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
                          : unexcused
                          ? t('detail_modal.unexcused_short')
                          : t('detail_modal.absence_not_counted')}
                        {editMode && <span className="ml-1 opacity-50">⇄</span>}
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
        <p className="py-4 text-center text-muted">{t('detail_modal.no_rehearsals')}</p>
      )}
    </div>
  );
}
