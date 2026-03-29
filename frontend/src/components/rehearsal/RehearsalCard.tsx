import { Card, CardBody, CardHeader, Button, Chip } from '@heroui/react';
import type { Rehearsal, AttendanceResponse } from '../../types';
import { attendanceApi } from '../../services/api';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDateLocale } from '../../hooks/useDateLocale';
import { formatDateTimeNoWeekday, formatDateTimeShort, formatTime } from '../../utils/dateFormatting';

interface Props {
  rehearsal: Rehearsal;
  onUpdated: () => void;
  readOnly?: boolean;
}

export function RehearsalCard({ rehearsal, onUpdated, readOnly = false }: Props) {
  const [loading, setLoading] = useState<AttendanceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();
  const dateLocale = useDateLocale();

  const hasStarted = new Date(rehearsal.date) <= new Date();
  const buttonsDisabled = readOnly || hasStarted;
  const endTime = rehearsal.durationMinutes
    ? formatTime(
        new Date(new Date(rehearsal.date).getTime() + rehearsal.durationMinutes * 60_000),
        dateLocale,
      )
    : null;
  const rehearsalDate = new Date(rehearsal.date);
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfRehearsalDay = new Date(rehearsalDate);
  startOfRehearsalDay.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((startOfRehearsalDay.getTime() - startOfToday.getTime()) / 86_400_000);
  const dayLabel = dayDiff === 0 ? t('rehearsals.today') : dayDiff === 1 ? t('rehearsals.tomorrow') : null;
  const dateLabel = dayLabel
    ? `${dayLabel}, ${formatDateTimeNoWeekday(rehearsal.date, dateLocale)}`
    : formatDateTimeShort(rehearsal.date, dateLocale);
  const location = rehearsal.location?.trim();
  const statusTintClass = rehearsal.myAttended === true
    ? 'bg-success-100/55 border-success-300/80 dark:border-success-300/80'
    : rehearsal.myAttended === false && rehearsal.myPlan === 'DECLINED'
      ? 'bg-warning-100/55 border-warning-300/80 dark:border-warning-400/80'
      : rehearsal.myAttended === false
        ? 'bg-danger-100/55 border-danger-200/80 dark:border-danger-400/80'
        : '';

  const setPlan = async (response: AttendanceResponse) => {
    if (buttonsDisabled) return;
    setLoading(response);
    setError(null);
    try {
      if (rehearsal.myPlan === response) {
        await attendanceApi.deletePlan(rehearsal.id);
      } else {
        await attendanceApi.setPlan(rehearsal.id, response);
      }
      onUpdated();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? t('rehearsals.error_rsvp'));
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card
      className={`w-full border border-default-200 ${readOnly ? 'opacity-80' : ''} ${statusTintClass} ${
        rehearsal.isOptional && !statusTintClass
          ? 'bg-primary-100/55 border border-primary-200/80 dark:border-primary-400/80'
          : ''
      }`}
      data-testid="rehearsal-card"
    >
      <CardHeader className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-2 w-full">
          <h3 className="text-lg font-semibold flex-1">{rehearsal.title}</h3>
          {rehearsal.isOptional && (
            <Chip size="sm" variant="flat" color="primary">
              {t('rehearsals.optional_badge')}
            </Chip>
          )}
          {readOnly && (
            <Chip size="sm" variant="flat" color="default">
              {t('rehearsals.past_chip')}
            </Chip>
          )}
        </div>
        <p className="text-sm text-default-500">
          {dateLabel}
          {endTime ? ` · ${t('rehearsals.ends_at', { time: endTime })}` : ''}
        </p>
        {location && (
          <p className="text-sm text-default-500">
            {t('rehearsals.location')}: {location}
          </p>
        )}
      </CardHeader>
      <CardBody className="flex flex-col gap-3">
        {rehearsal.description && (
          <p className="text-sm text-default-600">{rehearsal.description}</p>
        )}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t('rehearsals.my_rsvp')}</span>
          {rehearsal.myPlan === 'CONFIRMED' && <Chip color="success" size="sm">{t('rehearsals.confirmed')}</Chip>}
          {rehearsal.myPlan === 'DECLINED' && <Chip color="danger" size="sm">{t('rehearsals.declined')}</Chip>}
          {!rehearsal.myPlan && <Chip color="default" size="sm">{t('rehearsals.no_response')}</Chip>}
        </div>
        {rehearsal.myAttended != null && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{t('rehearsals.attendance_label')}</span>
            {rehearsal.myAttended === true && (
              <Chip color="success" size="sm" variant="flat">{t('rehearsals.present')}</Chip>
            )}
            {rehearsal.myAttended === false && rehearsal.myPlan === 'DECLINED' && (
              <Chip color="warning" size="sm" variant="flat">{t('rehearsals.excused')}</Chip>
            )}
            {rehearsal.myAttended === false && rehearsal.myPlan !== 'DECLINED' && (
              <Chip color="danger" size="sm">{t('rehearsals.unexcused_absence')}</Chip>
            )}
            {rehearsal.myAttended === null && (
              <Chip color="default" size="sm" variant="flat">{t('rehearsals.not_recorded')}</Chip>
            )}
          </div>
        )}
        {!readOnly && (
          <div className="flex gap-2">
            <Button
              size="sm"
              color="success"
              variant={rehearsal.myPlan === 'CONFIRMED' ? 'solid' : 'bordered'}
              className={rehearsal.myPlan === 'CONFIRMED' ? '' : 'bg-content1'}
              isLoading={loading === 'CONFIRMED'}
              onPress={() => setPlan('CONFIRMED')}
              isDisabled={buttonsDisabled}
            >
              {t('rehearsals.attending')}
            </Button>
            <Button
              size="sm"
              color="danger"
              variant={rehearsal.myPlan === 'DECLINED' ? 'solid' : 'bordered'}
              className={rehearsal.myPlan === 'DECLINED' ? '' : 'bg-content1'}
              isLoading={loading === 'DECLINED'}
              onPress={() => setPlan('DECLINED')}
              isDisabled={buttonsDisabled}
            >
              {t('rehearsals.not_attending')}
            </Button>
          </div>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
      </CardBody>
    </Card>
  );
}
