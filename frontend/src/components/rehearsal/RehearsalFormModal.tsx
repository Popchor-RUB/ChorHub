import { useEffect, useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Select,
  SelectItem,
  Textarea,
  DatePicker,
  Switch,
} from '@heroui/react';
import { I18nProvider } from '@react-aria/i18n';
import { CalendarDateTime } from '@internationalized/date';
import type { DateValue } from '@internationalized/date';
import { useTranslation } from 'react-i18next';
import { rehearsalsApi } from '../../services/api';
import type { Rehearsal } from '../../types';
import {
  adminInputClassNames,
  adminSelectClassNames,
  adminTextareaClassNames,
} from '../../styles/adminFormStyles';

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
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalContent>
        <ModalHeader>{rehearsal ? t('rehearsals.form_title_edit') : t('rehearsals.form_title_new')}</ModalHeader>
        <ModalBody className="pb-2 flex flex-col gap-3">
          <I18nProvider locale={i18nLocale}>
            <DatePicker
              label={t('rehearsals.date_time')}
              value={date}
              onChange={setDate}
              showMonthAndYearPickers
              hideTimeZone
              granularity="minute"
              isRequired
              hourCycle={24}
            />
          </I18nProvider>
          {!rehearsal && (
            <Select
              label={t('rehearsals.recurrence')}
              selectedKeys={[recurrencePattern]}
              classNames={adminSelectClassNames}
              onSelectionChange={(keys) => {
                if (keys === 'all') return;
                const selected = Array.from(keys)[0] as RecurrencePattern | undefined;
                setRecurrencePattern(selected ?? 'NONE');
              }}
            >
              <SelectItem key="NONE">{t('rehearsals.recurrence_none')}</SelectItem>
              <SelectItem key="DAILY">{t('rehearsals.recurrence_daily')}</SelectItem>
              <SelectItem key="WEEKLY">{t('rehearsals.recurrence_weekly')}</SelectItem>
              <SelectItem key="BIWEEKLY">{t('rehearsals.recurrence_biweekly')}</SelectItem>
              <SelectItem key="MONTHLY">{t('rehearsals.recurrence_monthly')}</SelectItem>
            </Select>
          )}
          {!rehearsal && recurrencePattern !== 'NONE' && (
            <I18nProvider locale={i18nLocale}>
              <DatePicker
                label={t('rehearsals.recurrence_end_date')}
                value={seriesEndDate}
                onChange={setSeriesEndDate}
                showMonthAndYearPickers
                hideTimeZone
                granularity="day"
                isRequired
                isInvalid={seriesRangeInvalid}
                errorMessage={seriesRangeInvalid ? t('rehearsals.recurrence_end_date_invalid') : undefined}
              />
            </I18nProvider>
          )}
          <Input
            label={t('common.title')}
            value={title}
            onValueChange={setTitle}
            isRequired
            classNames={adminInputClassNames}
          />
          <Input
            label={t('rehearsals.location')}
            value={location}
            onValueChange={setLocation}
            placeholder={t('common.optional')}
            classNames={adminInputClassNames}
          />
          <Input
            type="number"
            min={1}
            label={t('rehearsals.duration_minutes')}
            value={durationMinutes}
            onValueChange={setDurationMinutes}
            placeholder={t('common.optional')}
            classNames={adminInputClassNames}
          />
          <Switch
            isSelected={isOptional}
            onValueChange={setIsOptional}
          >
            {t('rehearsals.optional_rehearsal')}
          </Switch>
          <Textarea
            label={t('common.description')}
            value={description}
            onValueChange={setDescription}
            placeholder={t('common.optional')}
            classNames={adminTextareaClassNames}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            color="primary"
            isLoading={saving}
            onPress={handleSave}
            isDisabled={!date || !title || (isNewSeries && !seriesEndDate) || seriesRangeInvalid}
          >
            {t('common.save')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
