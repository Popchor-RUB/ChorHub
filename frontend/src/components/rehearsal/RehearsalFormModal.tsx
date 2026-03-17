import { useEffect, useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  DatePicker,
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

export function RehearsalFormModal({ rehearsal, isOpen, onClose, onSaved }: Props) {
  const [date, setDate] = useState<DateValue | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
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
      } else {
        setDate(null);
        setTitle('');
        setDescription('');
      }
    }
  }, [rehearsal, isOpen]);

  const handleSave = async () => {
    if (!date) return;
    setSaving(true);
    try {
      const isoDate = date.toDate('Europe/Berlin').toISOString();
      if (rehearsal) {
        await rehearsalsApi.update(rehearsal.id, {
          date: isoDate,
          title,
          description: description || undefined,
        });
      } else {
        await rehearsalsApi.create({ date: isoDate, title, description: description || undefined });
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
          <Input
            label={t('common.title')}
            value={title}
            onValueChange={setTitle}
            isRequired
          />
          <Textarea
            label={t('common.description')}
            value={description}
            onValueChange={setDescription}
            placeholder={t('common.optional')}
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
            isDisabled={!date || !title}
          >
            {t('common.save')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
