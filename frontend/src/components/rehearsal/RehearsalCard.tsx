import { Card, CardBody, CardHeader, Button, Chip } from '@heroui/react';
import type { Rehearsal, AttendanceResponse } from '../../types';
import { attendanceApi } from '../../services/api';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDateLocale } from '../../hooks/useDateLocale';
import { formatDateTimeLong, formatTime } from '../../utils/dateFormatting';

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
  const metaParts = [
    rehearsal.location?.trim() || null,
  ].filter(Boolean) as string[];

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
    <Card className={`w-full ${readOnly ? 'opacity-80' : ''}`} data-testid="rehearsal-card">
      <CardHeader className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-2 w-full">
          <h3 className="text-lg font-semibold flex-1">{rehearsal.title}</h3>
          {readOnly && (
            <Chip size="sm" variant="flat" color="default">
              {t('rehearsals.past_chip')}
            </Chip>
          )}
        </div>
        <p className="text-sm text-default-500">
          {formatDateTimeLong(rehearsal.date, dateLocale)}
          {endTime ? ` · ${t('rehearsals.ends_at', { time: endTime })}` : ''}
        </p>
        {metaParts.length > 0 && (
          <p className="text-sm text-default-500">{metaParts.join(' · ')}</p>
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
        <div className="flex gap-2">
          <Button
            size="sm"
            color="success"
            variant={rehearsal.myPlan === 'CONFIRMED' ? 'solid' : 'bordered'}
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
            isLoading={loading === 'DECLINED'}
            onPress={() => setPlan('DECLINED')}
            isDisabled={buttonsDisabled}
          >
            {t('rehearsals.not_attending')}
          </Button>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </CardBody>
    </Card>
  );
}
