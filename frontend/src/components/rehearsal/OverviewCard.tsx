import { Card, Button, Chip } from '@heroui/react';
import type { RehearsalOverview } from '../../types';
import { EditIcon } from '../icons/EditIcon';
import { TrashIcon } from '../icons/TrashIcon';
import { useTranslation } from 'react-i18next';
import { useDateLocale } from '../../hooks/useDateLocale';
import { formatDateTimeNoWeekday, formatDateTimeShort, formatTime } from '../../utils/dateFormatting';

interface Props {
  item: RehearsalOverview;
  type: 'future' | 'past';
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function OverviewCard({ item, type, onClick, onEdit, onDelete }: Props) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const rehearsalDate = new Date(item.date);
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfRehearsalDay = new Date(rehearsalDate);
  startOfRehearsalDay.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((startOfRehearsalDay.getTime() - startOfToday.getTime()) / 86_400_000);
  const dayLabel = dayDiff === 0 ? t('rehearsals.today') : dayDiff === 1 ? t('rehearsals.tomorrow') : null;
  const dateLabel = dayLabel
    ? `${dayLabel}, ${formatDateTimeNoWeekday(item.date, dateLocale)}`
    : formatDateTimeShort(item.date, dateLocale);
  const endTime = item.durationMinutes
    ? formatTime(
        new Date(new Date(item.date).getTime() + item.durationMinutes * 60_000),
        dateLocale,
      )
    : null;
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onClick();
      }}
      className={`w-full text-left transition-shadow hover:shadow-md ${
        item.isOptional
          ? 'bg-accent-soft/55 border border-accent/80 dark:border-accent/80 opacity-80'
          : ''
      }`}
    >
      <Card.Content className="gap-2">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold">{item.title}</p>
              {item.isOptional && (
                <Chip size="sm" variant="primary" color="accent">
                  {t('rehearsals.optional_badge')}
                </Chip>
              )}
            </div>
            <p className="text-sm text-muted">
              {dateLabel}
              {endTime ? ` · ${t('rehearsals.ends_at', { time: endTime })}` : ''}
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              <Chip className="bg-accent-soft text-accent-soft-foreground" variant="primary" size="sm">
                {item.totalConfirmed ?? 0} {t('attendance_detail.label_confirmed')}
              </Chip>
              {type === 'past' && (
                <Chip className="bg-success-soft text-success-soft-foreground" variant="primary" size="sm">
                  {item.totalAttended ?? 0} {t('attendance_detail.label_present')}
                </Chip>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              isIconOnly
              size="sm"
              variant="primary"
              aria-label={t('rehearsals.edit')}
              onPress={onEdit}
            >
              <EditIcon />
            </Button>
            <Button
              isIconOnly
              size="sm"
              variant="danger-soft"
              aria-label={t('rehearsals.delete')}
              onPress={onDelete}
            >
              <TrashIcon />
            </Button>
            <span className="text-muted text-lg ml-1">›</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-1">
          {Object.entries(item.byVoice).map(([name, count]) => (
            <Chip key={name} size="sm" variant="primary">
              {name}: {count}
            </Chip>
          ))}
        </div>
      </Card.Content>
    </Card>
  );
}
