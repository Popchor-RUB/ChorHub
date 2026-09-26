import type { ReactNode, Ref } from 'react';
import { Button, CloseButton, Header, Input, Label, ListBox, Select, Separator, Spinner, TextField } from '@heroui/react';
import { QrCodeIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import type { Rehearsal } from '../../types';
import type { AttendanceRowMember } from './AttendanceMemberRow';
import { useDateLocale } from '../../hooks/useDateLocale';
import { formatDateLong, formatDateNumeric } from '../../utils/dateFormatting';

type Props<T extends AttendanceRowMember> = {
  rehearsals: Rehearsal[];
  selectedRehearsalId: string;
  onSelectRehearsal: (id: string) => void;
  records: T[];
  loadingRecords: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onOpenScanner?: () => void;
  extraActions?: ReactNode;
  belowSearch?: ReactNode;
  statusMessage?: ReactNode;
  footer?: ReactNode;
  searchRef?: Ref<HTMLInputElement>;
  renderRecords: (records: T[]) => ReactNode;
};

export function AttendanceEditor<T extends AttendanceRowMember>({
  rehearsals,
  selectedRehearsalId,
  onSelectRehearsal,
  records,
  loadingRecords,
  search,
  onSearchChange,
  onOpenScanner,
  extraActions,
  belowSearch,
  statusMessage,
  footer,
  searchRef,
  renderRecords,
}: Props<T>) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const eligibleRehearsals = rehearsals.filter((rehearsal) => !rehearsal.isOptional);
  const pastRehearsals = eligibleRehearsals
    .filter((rehearsal) => new Date(rehearsal.date) < startOfToday)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const futureRehearsals = eligibleRehearsals
    .filter((rehearsal) => new Date(rehearsal.date) >= startOfToday)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const selectedRehearsal = rehearsals.find((rehearsal) => rehearsal.id === selectedRehearsalId);
  const attendedCount = records.filter((record) => record.attended).length;
  const query = search.trim().toLocaleLowerCase();
  const visibleRecords = records.filter((record) => !query
    || `${record.firstName} ${record.lastName}`.toLocaleLowerCase().includes(query)
    || `${record.lastName} ${record.firstName}`.toLocaleLowerCase().includes(query));

  return (
    <>
      <div className="flex flex-col gap-2">
        <Select
          placeholder={t('attendance.select_rehearsal')}
          value={selectedRehearsalId || null}
          onChange={(key) => onSelectRehearsal(typeof key === 'string' ? key : '')}
        >
          <Label>{t('attendance.rehearsal_label')}</Label>
          <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Section>
                <Header>{t('attendance.upcoming_rehearsals')}</Header>
                {futureRehearsals.map((rehearsal) => {
                  const textValue = `${formatDateNumeric(rehearsal.date, dateLocale)} – ${rehearsal.title}`;
                  return <ListBox.Item key={rehearsal.id} id={rehearsal.id} textValue={textValue}>{textValue}<ListBox.ItemIndicator /></ListBox.Item>;
                })}
                <Separator />
              </ListBox.Section>
              <ListBox.Section>
                <Header>{t('attendance.past_rehearsals')}</Header>
                {pastRehearsals.map((rehearsal) => {
                  const textValue = `${formatDateNumeric(rehearsal.date, dateLocale)} – ${rehearsal.title}`;
                  return <ListBox.Item key={rehearsal.id} id={rehearsal.id} textValue={textValue}>{textValue}<ListBox.ItemIndicator /></ListBox.Item>;
                })}
              </ListBox.Section>
            </ListBox>
          </Select.Popover>
        </Select>
        {selectedRehearsal && !loadingRecords && (
          <p className="text-sm text-muted px-1">
            {formatDateLong(selectedRehearsal.date, dateLocale)} · {t('attendance.present_of', { attended: attendedCount, total: records.length })}
          </p>
        )}
        {loadingRecords && <Spinner size="sm" />}
      </div>

      {selectedRehearsalId && !loadingRecords && (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <TextField className="flex-1" value={search} onChange={onSearchChange} aria-label={t('attendance.filter_name')}>
                <div className="flex items-center gap-1">
                  <Input ref={searchRef} placeholder={t('attendance.filter_name')} />
                  {search && <CloseButton aria-label={t('attendance.filter_name')} onPress={() => onSearchChange('')} />}
                </div>
              </TextField>
              {onOpenScanner && (
                <Button
                  size="sm"
                  variant="tertiary"
                  isIconOnly
                  aria-label={t('checkin.admin_scan_button')}
                  data-testid="attendance-open-qr-scanner"
                  onPress={onOpenScanner}
                >
                  <QrCodeIcon className="w-5 h-5" />
                </Button>
              )}
              {extraActions}
            </div>
            {belowSearch}
          </div>
          {statusMessage}
          {renderRecords(visibleRecords)}
          {footer}
        </>
      )}
    </>
  );
}
