import { Card, Button, Chip } from '@heroui/react';
import type { Rehearsal, AttendanceResponse } from '../../types';
import { attendanceApi } from '../../services/api';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  const statusColor = rehearsal.myAttended === true
    ? { tint: 'bg-success-soft', border: 'border-success/80' }
    : rehearsal.myAttended === false && rehearsal.myPlan === 'DECLINED'
      ? { tint: 'bg-warning-soft', border: 'border-warning/25' }
      : rehearsal.myAttended === false
        ? { tint: 'bg-danger-soft', border: 'border-danger/25' }
        : null;
  const cardColor = statusColor ?? (rehearsal.isOptional
    ? { tint: 'bg-accent-soft/60', border: 'border-accent/80 dark:border-accent/80' }
    : null);

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
      className={`isolate w-full border bg-surface ${readOnly ? 'opacity-80' : ''} ${cardColor?.border ?? ''}`}
      data-testid="rehearsal-card"
    >
      {cardColor && (
        <div aria-hidden="true" className={`pointer-events-none absolute inset-px rounded-[inherit] ${cardColor.tint}`} />
      )}
      <Card.Header className="relative z-10 flex flex-col items-start gap-1">
        <div className="flex items-center gap-2 w-full">
          <h3 className="text-lg font-semibold flex-1">{rehearsal.title}</h3>
          {rehearsal.isOptional && (
            <Chip size="sm" variant="primary" color="accent">
              {t('rehearsals.optional_badge')}
            </Chip>
          )}
          {readOnly && (
            <Chip size="sm" variant="primary" color="default">
              {t('rehearsals.past_chip')}
            </Chip>
          )}
        </div>
        <p className="text-sm text-muted">
          {dateLabel}
          {endTime ? ` · ${t('rehearsals.ends_at', { time: endTime })}` : ''}
        </p>
        {location && (
          <p className="text-sm text-muted">
            {t('rehearsals.location')}: {location}
          </p>
        )}
      </Card.Header>
      <Card.Content className="relative z-10 flex flex-col gap-2 pt-0">
        {rehearsal.description && (
          <div className="prose max-w-none text-sm text-foreground leading-relaxed pb-1">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p className="!my-0">{children}</p>,
                ul: ({ children }) => <ul className="my-0 pl-5">{children}</ul>,
                ol: ({ children }) => <ol className="my-0 pl-5">{children}</ol>,
                li: ({ children }) => <li className="my-0">{children}</li>,
              }}
            >
              {rehearsal.description}
            </ReactMarkdown>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t('rehearsals.my_rsvp')}</span>
          {rehearsal.myPlan === 'CONFIRMED' && <Chip color="success" variant='primary' size="sm">{t('rehearsals.confirmed')}</Chip>}
          {rehearsal.myPlan === 'DECLINED' && <Chip color="danger" variant='primary' size="sm">{t('rehearsals.declined')}</Chip>}
          {!rehearsal.myPlan && <Chip color="default" variant='primary' size="sm">{t('rehearsals.no_response')}</Chip>}
        </div>
        {rehearsal.myAttended != null && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{t('rehearsals.attendance_label')}</span>
            {rehearsal.myAttended === true && (
              <Chip color="success" size="sm" variant="primary">{t('rehearsals.present')}</Chip>
            )}
            {rehearsal.myAttended === false && rehearsal.myPlan === 'DECLINED' && (
              <Chip color="warning" size="sm" variant="primary">{t('rehearsals.excused')}</Chip>
            )}
            {rehearsal.myAttended === false && rehearsal.myPlan !== 'DECLINED' && (
              <Chip color="danger" size="sm">{t('rehearsals.unexcused_absence')}</Chip>
            )}
            {rehearsal.myAttended === null && (
              <Chip color="default" size="sm" variant="primary">{t('rehearsals.not_recorded')}</Chip>
            )}
          </div>
        )}
        {!readOnly && (
          <div className="flex gap-2">
            <Button
              size="sm"
              className={rehearsal.myPlan === 'CONFIRMED' ? 'bg-success border' : 'bg-success-soft text-success-soft-foreground border'}
              isPending={loading === 'CONFIRMED'}
              onPress={() => setPlan('CONFIRMED')}
              isDisabled={buttonsDisabled}
            >
              {t('rehearsals.attending')}
            </Button>
            <Button
              size="sm"
              className={rehearsal.myPlan === 'DECLINED' ? 'bg-danger border' : 'bg-danger-soft text-danger-soft-foreground border'}
              isPending={loading === 'DECLINED'}
              onPress={() => setPlan('DECLINED')}
              isDisabled={buttonsDisabled}
            >
              {t('rehearsals.not_attending')}
            </Button>
          </div>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
      </Card.Content>
    </Card>
  );
}
