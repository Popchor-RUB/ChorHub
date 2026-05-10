import { CheckIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { Button, Chip, Spinner } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import type { MemberRehearsalEntry } from '../../types';
import { formatDateMedium } from '../../utils/dateFormatting';

type Props = {
  rehearsals: MemberRehearsalEntry[];
  dateLocale: string;
  editMode: boolean;
  setEditMode: (next: boolean | ((prev: boolean) => boolean)) => void;
  savingId: string | null;
  showAllUpcoming: boolean;
  setShowAllUpcoming: (next: boolean) => void;
  onToggleUpcomingPlan: (rehearsal: MemberRehearsalEntry) => void;
  onTogglePastAttendance: (rehearsal: MemberRehearsalEntry) => void;
  title?: string;
  className?: string;
  testIdPrefix?: string;
  showEditToggle?: boolean;
};

export function MemberRehearsalOverview({
  rehearsals,
  dateLocale,
  editMode,
  setEditMode,
  savingId,
  showAllUpcoming,
  setShowAllUpcoming,
  onToggleUpcomingPlan,
  onTogglePastAttendance,
  title,
  className,
  testIdPrefix,
  showEditToggle = true,
}: Props) {
  const { t } = useTranslation();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const past = rehearsals.filter((r) => new Date(r.date) < startOfToday).reverse();
  const upcoming = rehearsals.filter((r) => new Date(r.date) >= startOfToday);
  const visibleUpcoming = showAllUpcoming ? upcoming : upcoming.slice(0, 5);
  const hasHiddenUpcoming = upcoming.length > visibleUpcoming.length;
  const countablePast = past.filter((r) => !r.isOptional);
  const countableUpcoming = upcoming.filter((r) => !r.isOptional);

  const unexcusedCount = countablePast.filter((r) => !r.attended && r.plan !== 'DECLINED').length;
  const excusedCount = countablePast.filter((r) => !r.attended && r.plan === 'DECLINED').length;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {title ? <h2 className="text-lg font-semibold">{title}</h2> : <span />}
        {showEditToggle && (
          <Button
            isIconOnly
            size="sm"
            variant={editMode ? 'solid' : 'flat'}
            color={editMode ? 'primary' : 'default'}
            aria-label={editMode ? t('detail_modal.edit_mode_done') : t('detail_modal.edit_mode_toggle')}
            title={editMode ? t('detail_modal.edit_mode_done') : t('detail_modal.edit_mode_toggle')}
            onPress={() => setEditMode((v) => !v)}
            data-testid={testIdPrefix ? `${testIdPrefix}-edit-mode-toggle` : undefined}
          >
            {editMode ? <CheckIcon className="h-4 w-4" /> : <PencilSquareIcon className="h-4 w-4" />}
          </Button>
        )}
      </div>

      <div className="mb-4 mt-4 flex flex-wrap gap-2">
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
        <div className="mb-5" data-testid={testIdPrefix ? `${testIdPrefix}-upcoming-section` : undefined}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-default-400">
            {t('detail_modal.upcoming_rehearsals')}
          </p>
          <div className="flex flex-col gap-1">
            {visibleUpcoming.map((r) => {
              const isSaving = savingId === r.id;
              const rowClassName = r.plan === 'CONFIRMED'
                ? 'bg-success-50 text-success-800'
                : r.plan === 'DECLINED'
                ? 'bg-danger-50 text-danger-800'
                : 'bg-default-50 text-default-500';

              return (
                <div
                  key={r.id}
                  data-testid={testIdPrefix ? `${testIdPrefix}-upcoming-row-${r.id}` : undefined}
                  onClick={editMode ? () => onToggleUpcomingPlan(r) : undefined}
                  className={`flex flex-col items-start gap-1 rounded-lg px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between ${rowClassName} ${editMode ? 'cursor-pointer transition-opacity hover:opacity-75' : ''}`}
                >
                  <span className="font-medium">
                    {formatDateMedium(r.date, dateLocale)} - {r.title}
                    {r.isOptional && (
                      <span className="ml-2 text-[11px] uppercase tracking-wide text-warning-700">
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
              <Button color="primary" onPress={() => setShowAllUpcoming(true)}>
                {t('rehearsals.show_all')}
              </Button>
            </div>
          )}
        </div>
      )}

      {past.length > 0 && (
        <div data-testid={testIdPrefix ? `${testIdPrefix}-past-section` : undefined}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-default-400">
            {t('detail_modal.past_rehearsals')}
          </p>
          <div className="flex flex-col gap-1">
            {past.map((r) => {
              const unexcused = !r.isOptional && !r.attended && r.plan !== 'DECLINED';
              const isSaving = savingId === r.id;
              const rowClassName = r.isOptional
                ? 'bg-default-50 text-default-500'
                : r.attended
                ? 'bg-success-50 text-success-800'
                : unexcused
                ? 'bg-danger-50 text-danger-800'
                : 'bg-default-50 text-default-500';

              return (
                <div
                  key={r.id}
                  data-testid={testIdPrefix ? `${testIdPrefix}-past-row-${r.id}` : undefined}
                  onClick={editMode ? () => onTogglePastAttendance(r) : undefined}
                  className={`flex flex-col items-start gap-1 rounded-lg px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between ${rowClassName} ${editMode ? 'cursor-pointer transition-opacity hover:opacity-75' : ''}`}
                >
                  <span className="font-medium">
                    {formatDateMedium(r.date, dateLocale)} - {r.title}
                    {r.isOptional && (
                      <span className="ml-2 text-[11px] uppercase tracking-wide text-warning-700">
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
                          : t('detail_modal.unexcused_short')}
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
        <p className="py-4 text-center text-default-400">{t('detail_modal.no_rehearsals')}</p>
      )}
    </div>
  );
}
