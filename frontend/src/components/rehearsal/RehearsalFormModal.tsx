import { useEffect, useState } from 'react';
import {
  Modal,
  Button,
  Calendar,
  DateField,
  FieldError,
  Input,
  Label,
  ListBox,
  Select,
  Spinner,
  TextArea,
  TextField,
  DatePicker,
  Switch,
} from '@heroui/react';
import { I18nProvider } from '@react-aria/i18n';
import { CalendarDateTime } from '@internationalized/date';
import type { DateValue } from '@internationalized/date';
import { useTranslation } from 'react-i18next';
import { rehearsalsApi } from '../../services/api';
import type { Rehearsal } from '../../types';

interface Props {
  rehearsal: Rehearsal | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

type RecurrencePattern = 'NONE' | 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
const APP_TIMEZONE = 'Europe/Berlin';

function addMonthsKeepingDay(base: Date, months: number, anchorDay: number) {
  const next = new Date(base);
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDayOfMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(anchorDay, lastDayOfMonth));
  return next;
}

function buildRecurringDates(start: Date, end: Date, pattern: RecurrencePattern) {
  const dates: Date[] = [];
  const anchorDay = start.getDate();
  let cursor = new Date(start);

  while (cursor <= end) {
    dates.push(new Date(cursor));
    if (pattern === 'MONTHLY') {
      cursor = addMonthsKeepingDay(cursor, 1, anchorDay);
    } else {
      const stepDays = pattern === 'DAILY' ? 1 : pattern === 'WEEKLY' ? 7 : 14;
      cursor = new Date(cursor);
      cursor.setDate(cursor.getDate() + stepDays);
    }
  }

  return dates;
}

export function RehearsalFormModal({ rehearsal, isOpen, onClose, onSaved }: Props) {
  const [date, setDate] = useState<DateValue | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [isOptional, setIsOptional] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>('NONE');
  const [seriesEndDate, setSeriesEndDate] = useState<DateValue | null>(null);
  const [saving, setSaving] = useState(false);
  const { t, i18n } = useTranslation();
  const i18nLocale = i18n.language.startsWith('en') ? 'en-GB' : 'de-DE';

  useEffect(() => {
    if (isOpen) {
      if (rehearsal) {
        const d = new Date(rehearsal.date);
        setDate(
          new CalendarDateTime(
            d.getFullYear(),
            d.getMonth() + 1,
            d.getDate(),
            d.getHours(),
            d.getMinutes()
          )
        );
        setTitle(rehearsal.title);
        setDescription(rehearsal.description ?? '');
        setLocation(rehearsal.location ?? '');
        setDurationMinutes(
          rehearsal.durationMinutes !== null && rehearsal.durationMinutes !== undefined
            ? String(rehearsal.durationMinutes)
            : '',
        );
        setIsOptional(Boolean(rehearsal.isOptional));
      } else {
        setDate(null);
        setTitle('');
        setDescription('');
        setLocation('');
        setDurationMinutes('');
        setIsOptional(false);
        setRecurrencePattern('NONE');
        setSeriesEndDate(null);
      }
    }
  }, [rehearsal, isOpen]);

  const isNewSeries = !rehearsal && recurrencePattern !== 'NONE';
  const seriesRangeInvalid = (() => {
    if (!isNewSeries || !date || !seriesEndDate) return false;
    const startDate = date.toDate(APP_TIMEZONE);
    const endDate = seriesEndDate.toDate(APP_TIMEZONE);
    endDate.setHours(23, 59, 59, 999);
    return startDate > endDate;
  })();

  const handleSave = async () => {
    if (!date) return;
    if (isNewSeries && !seriesEndDate) return;
    const normalizedDuration = durationMinutes.trim();
    const parsedDuration = normalizedDuration ? Number.parseInt(normalizedDuration, 10) : undefined;
    setSaving(true);
    try {
      const startDate = date.toDate(APP_TIMEZONE);
      const baseData = {
        title,
        description: description || undefined,
        location: location || undefined,
        durationMinutes: Number.isFinite(parsedDuration) ? parsedDuration : undefined,
        isOptional,
      };

      if (rehearsal) {
        await rehearsalsApi.update(rehearsal.id, {
          date: startDate.toISOString(),
          ...baseData,
        });
      } else {
        if (recurrencePattern === 'NONE') {
          await rehearsalsApi.create({
            date: startDate.toISOString(),
            ...baseData,
          });
        } else {
          const endDate = seriesEndDate!.toDate(APP_TIMEZONE);
          endDate.setHours(23, 59, 59, 999);

          const dates = buildRecurringDates(startDate, endDate, recurrencePattern);
          for (const occurrenceDate of dates) {
            await rehearsalsApi.create({
              date: occurrenceDate.toISOString(),
              ...baseData,
            });
          }
        }
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Modal.Container size="lg">
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header><Modal.Heading>{rehearsal ? t('rehearsals.form_title_edit') : t('rehearsals.form_title_new')}</Modal.Heading></Modal.Header>
          <Modal.Body className="flex flex-col gap-3 pb-2">
          <I18nProvider locale={i18nLocale}>
            <DatePicker
              value={date}
              onChange={setDate}
              hideTimeZone
              granularity="minute"
              isRequired
              hourCycle={24}
            >
              <Label>{t('rehearsals.date_time')}</Label>
              <DateField.Group variant="secondary">
                <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
                <DateField.Suffix><DatePicker.Trigger><DatePicker.TriggerIndicator /></DatePicker.Trigger></DateField.Suffix>
              </DateField.Group>
              <DatePicker.Popover>
                <Calendar aria-label={t('rehearsals.date_time')}>
                  <Calendar.Header>
                    <Calendar.YearPickerTrigger><Calendar.YearPickerTriggerHeading /><Calendar.YearPickerTriggerIndicator /></Calendar.YearPickerTrigger>
                    <Calendar.NavButton slot="previous" /><Calendar.NavButton slot="next" />
                  </Calendar.Header>
                  <Calendar.Grid>
                    <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
                    <Calendar.GridBody>{(calendarDate) => <Calendar.Cell date={calendarDate} />}</Calendar.GridBody>
                  </Calendar.Grid>
                  <Calendar.YearPickerGrid><Calendar.YearPickerGridBody>{({ year }) => <Calendar.YearPickerCell year={year} />}</Calendar.YearPickerGridBody></Calendar.YearPickerGrid>
                </Calendar>
              </DatePicker.Popover>
            </DatePicker>
          </I18nProvider>
          {!rehearsal && (
            <Select
              variant="secondary"
              value={recurrencePattern}
              onChange={(key) => setRecurrencePattern(typeof key === 'string' ? key as RecurrencePattern : 'NONE')}
            >
              <Label>{t('rehearsals.recurrence')}</Label>
              <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
              <Select.Popover><ListBox>
                <ListBox.Item id="NONE" textValue={t('rehearsals.recurrence_none')}>{t('rehearsals.recurrence_none')}<ListBox.ItemIndicator /></ListBox.Item>
                <ListBox.Item id="DAILY" textValue={t('rehearsals.recurrence_daily')}>{t('rehearsals.recurrence_daily')}<ListBox.ItemIndicator /></ListBox.Item>
                <ListBox.Item id="WEEKLY" textValue={t('rehearsals.recurrence_weekly')}>{t('rehearsals.recurrence_weekly')}<ListBox.ItemIndicator /></ListBox.Item>
                <ListBox.Item id="BIWEEKLY" textValue={t('rehearsals.recurrence_biweekly')}>{t('rehearsals.recurrence_biweekly')}<ListBox.ItemIndicator /></ListBox.Item>
                <ListBox.Item id="MONTHLY" textValue={t('rehearsals.recurrence_monthly')}>{t('rehearsals.recurrence_monthly')}<ListBox.ItemIndicator /></ListBox.Item>
              </ListBox></Select.Popover>
            </Select>
          )}
          {!rehearsal && recurrencePattern !== 'NONE' && (
            <I18nProvider locale={i18nLocale}>
              <DatePicker
                value={seriesEndDate}
                onChange={setSeriesEndDate}
                hideTimeZone
                granularity="day"
                isRequired
                isInvalid={seriesRangeInvalid}
              >
                <Label>{t('rehearsals.recurrence_end_date')}</Label>
                <DateField.Group variant="secondary">
                  <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
                  <DateField.Suffix><DatePicker.Trigger><DatePicker.TriggerIndicator /></DatePicker.Trigger></DateField.Suffix>
                </DateField.Group>
                <DatePicker.Popover>
                  <Calendar aria-label={t('rehearsals.recurrence_end_date')}>
                    <Calendar.Header>
                      <Calendar.YearPickerTrigger><Calendar.YearPickerTriggerHeading /><Calendar.YearPickerTriggerIndicator /></Calendar.YearPickerTrigger>
                      <Calendar.NavButton slot="previous" /><Calendar.NavButton slot="next" />
                    </Calendar.Header>
                    <Calendar.Grid>
                      <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
                      <Calendar.GridBody>{(calendarDate) => <Calendar.Cell date={calendarDate} />}</Calendar.GridBody>
                    </Calendar.Grid>
                    <Calendar.YearPickerGrid><Calendar.YearPickerGridBody>{({ year }) => <Calendar.YearPickerCell year={year} />}</Calendar.YearPickerGridBody></Calendar.YearPickerGrid>
                  </Calendar>
                </DatePicker.Popover>
                {seriesRangeInvalid && <FieldError>{t('rehearsals.recurrence_end_date_invalid')}</FieldError>}
              </DatePicker>
            </I18nProvider>
          )}
          <TextField className="w-full" variant="secondary" value={title} onChange={setTitle} isRequired>
            <Label>{t('common.title')}</Label><Input />
          </TextField>
          <TextField className="w-full" variant="secondary"
            value={location}
            onChange={setLocation}
          >
            <Label>{t('rehearsals.location')}</Label>
            <Input placeholder={t('common.optional')} />
          </TextField>
          <TextField
            className="w-full"
            variant="secondary"
            type="number"
            value={durationMinutes}
            onChange={setDurationMinutes}
          >
            <Label>{t('rehearsals.duration_minutes')}</Label>
            <Input min={1} placeholder={t('common.optional')} />
          </TextField>
          <Switch
            isSelected={isOptional}
            onChange={setIsOptional}
          >
            <Switch.Content><Switch.Control><Switch.Thumb /></Switch.Control>{t('rehearsals.optional_rehearsal')}</Switch.Content>
          </Switch>
          <TextField className="w-full" variant="secondary" value={description} onChange={setDescription}>
            <Label>{t('common.description')}</Label>
            <TextArea rows={4} placeholder={t('common.optional')} />
          </TextField>
          </Modal.Body>
          <Modal.Footer>
          <Button variant="tertiary" onPress={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            isPending={saving}
            onPress={handleSave}
            isDisabled={!date || !title || (isNewSeries && !seriesEndDate) || seriesRangeInvalid}
          >
            {({ isPending }) => <>{isPending && <Spinner color="current" size="sm" />}{t('common.save')}</>}
          </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
