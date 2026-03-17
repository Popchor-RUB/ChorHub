import { Card, CardBody, Button, Chip } from '@heroui/react';
import type { RehearsalOverview } from '../../types';
import { EditIcon } from '../icons/EditIcon';
import { TrashIcon } from '../icons/TrashIcon';
import { useTranslation } from 'react-i18next';
import { useDateLocale } from '../../hooks/useDateLocale';
import { formatDateTimeShort } from '../../utils/dateFormatting';

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
  return (
    <Card
      isPressable
      onPress={onClick}
      className="w-full text-left hover:shadow-md transition-shadow"
    >
      <CardBody className="gap-2">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="font-semibold">{item.title}</p>
            <p className="text-sm text-default-500">{formatDateTimeShort(item.date, dateLocale)}</p>
          </div>
          <div className="flex items-center gap-1">
            <Chip color={type === 'future' ? 'primary' : 'success'} variant="flat" size="lg">
              {total}{' '}
              {type === 'future'
                ? t('attendance_detail.label_confirmed')
                : t('attendance_detail.label_present')}
            </Chip>
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
