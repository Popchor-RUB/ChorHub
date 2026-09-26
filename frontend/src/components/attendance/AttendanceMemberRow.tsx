import { Button, Spinner } from '@heroui/react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import type { AttendanceResponse, ChoirVoice } from '../../types';

export interface AttendanceRowMember {
  id: string;
  firstName: string;
  lastName: string;
  choirVoice: ChoirVoice | null;
  attended: boolean;
  plan: AttendanceResponse | null;
  lastAttendedRehearsalsAgo: number | null;
}

type Props = {
  member: AttendanceRowMember;
  saving: boolean;
  onToggle: () => void;
  formatLastAttended: (ago: number | null) => string;
  onOpenDetail?: () => void;
  focused?: boolean;
  shortcutNum?: number | null;
  unexcusedAbsenceCount?: number;
  rowRef?: (element: HTMLDivElement | null) => void;
  onFocus?: () => void;
  testId?: string;
};

export function AttendanceMemberRow({
  member,
  saving,
  onToggle,
  formatLastAttended,
  onOpenDetail,
  focused = false,
  shortcutNum = null,
  unexcusedAbsenceCount,
  rowRef,
  onFocus,
  testId = 'attendance-member-row',
}: Props) {
  const { t } = useTranslation();
  const hasHighUnexcusedAbsences = typeof unexcusedAbsenceCount === 'number' && unexcusedAbsenceCount > 3;

  return (
    <div
      data-testid={testId}
      data-member-id={member.id}
      ref={rowRef}
      className={[
        'grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_160px_110px] items-center px-4 py-3 transition-colors',
        member.attended ? 'bg-success-soft dark:bg-success-900/20' : 'bg-surface',
        focused ? 'ring-2 ring-inset ring-primary' : '',
      ].filter(Boolean).join(' ')}
      onClick={onFocus}
    >
      <div className="min-w-0">
        {onOpenDetail ? (
          <button
            type="button"
            className="font-medium text-sm cursor-pointer transition-colors text-accent inline-flex items-center gap-1 max-w-full"
            onClick={(event) => { event.stopPropagation(); onOpenDetail(); }}
          >
            <span className="truncate">{member.firstName} {member.lastName}</span>
            <MagnifyingGlassIcon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
          </button>
        ) : (
          <p className="font-medium text-sm">{member.firstName} {member.lastName}</p>
        )}
        {member.plan === null && (
          <p className="text-xs text-danger mt-0.5">{t('attendance.no_plan_notice')}</p>
        )}
        {hasHighUnexcusedAbsences && (
          <p className="text-xs text-danger mt-0.5">
            {t('attendance.unexcused_warning', { count: unexcusedAbsenceCount })}
          </p>
        )}
        <p className="text-xs text-muted sm:hidden mt-0.5">{formatLastAttended(member.lastAttendedRehearsalsAgo)}</p>
      </div>
      <p className="hidden sm:block text-sm text-muted">{formatLastAttended(member.lastAttendedRehearsalsAgo)}</p>
      <div className="flex justify-end items-center gap-1.5">
        {shortcutNum !== null && (
          <span className="hidden sm:block text-xs font-mono text-muted w-4 text-center">{shortcutNum}</span>
        )}
        <Button
          size="sm"
          variant={member.attended ? 'primary' : 'secondary'}
          isPending={saving}
          onPress={onToggle}
          className="min-w-[90px]"
        >
          {({ isPending }) => <>{isPending && <Spinner color="current" size="sm" />}{member.attended ? t('attendance.btn_present') : t('attendance.btn_record')}</>}
        </Button>
      </div>
    </div>
  );
}
