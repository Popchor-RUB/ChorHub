import { Card, CardBody, Button, Chip } from '@heroui/react';
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
  const total = type === 'future' ? item.totalConfirmed ?? 0 : item.totalAttended ?? 0;
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
      isPressable
      onPress={onClick}
      className={`w-full text-left hover:shadow-md transition-shadow border border-default-200 ${
        item.isOptional
          ? 'bg-primary-100/55 border border-primary-200/80 dark:border-primary-400/80 opacity-80'
          : ''
      }`}
    >
      <CardBody className="gap-2">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold">{item.title}</p>
              {item.isOptional && (
                <Chip size="sm" variant="flat" color="primary">
                  {t('rehearsals.optional_badge')}
                </Chip>
              )}
            </div>
            <p className="text-sm text-default-500">
              {dateLabel}
              {endTime ? ` · ${t('rehearsals.ends_at', { time: endTime })}` : ''}
            </p>
            <div className="mt-1">
              <Chip color={type === 'future' ? 'primary' : 'success'} variant="flat" size="sm">
                {total}{' '}
                {type === 'future'
                  ? t('attendance_detail.label_confirmed')
                  : t('attendance_detail.label_present')}
              </Chip>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              aria-label={t('rehearsals.edit')}
              onPress={onEdit}
            >
              <EditIcon />
            </Button>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              color="danger"
              aria-label={t('rehearsals.delete')}
              onPress={onDelete}
            >
              <TrashIcon />
            </Button>
            <span className="text-default-300 text-lg ml-1">›</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-1">
          {Object.entries(item.byVoice).map(([name, count]) => (
            <Chip key={name} size="sm" variant="flat">
              {name}: {count}
            </Chip>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
