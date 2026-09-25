import { useEffect, useState } from 'react';
import {
  Modal,
  Button,
  Input,
  Label,
  ListBox,
  Select,
  Spinner,
  TextField,
} from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { adminMembersApi, choirVoicesApi } from '../../services/api';
import type { ChoirVoice } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  onCreatedWithId?: (memberId: string) => void;
}

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  voiceId: string;
}

const EMPTY_FORM: FormState = { firstName: '', lastName: '', email: '', voiceId: '' };

export function CreateMemberModal({ isOpen, onClose, onCreated, onCreatedWithId }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [voices, setVoices] = useState<ChoirVoice[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    choirVoicesApi.list().then((res) => setVoices(res.data as ChoirVoice[]));
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setForm(EMPTY_FORM);
      setError(null);
    }
  }, [isOpen]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await adminMembersApi.create({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        ...(form.voiceId ? { voiceId: form.voiceId } : {}),
      });
      const memberId = (res.data as { id: string }).id;
      onCreatedWithId?.(memberId);
      onCreated();
      onClose();
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        setError(t('members.create_error_email_taken'));
      } else {
        setError(t('common.error_generic'));
      }
    } finally {
      setSaving(false);
    }
  };

  const isValid = form.firstName.trim() && form.lastName.trim() && form.email.trim();

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Modal.Container size="md">
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header><Modal.Heading>{t('members.create_title')}</Modal.Heading></Modal.Header>
          <Modal.Body className="flex flex-col gap-3">
          <div className="flex gap-3">
            <TextField
              className="w-full"
              variant="secondary"
              value={form.firstName}
              onChange={(value) => setField('firstName', value)}
              isRequired
            >
              <Label>{t('members.create_first_name')}</Label>
              <Input autoFocus />
            </TextField>
            <TextField
              className="w-full"
              variant="secondary"
              value={form.lastName}
              onChange={(value) => setField('lastName', value)}
              isRequired
            >
              <Label>{t('members.create_last_name')}</Label>
              <Input />
            </TextField>
          </div>
          <TextField
            className="w-full"
            variant="secondary"
            type="email"
            value={form.email}
            onChange={(value) => setField('email', value)}
            isRequired
          >
            <Label>{t('members.create_email')}</Label>
            <Input />
          </TextField>
          {voices.length > 0 && (
            <Select
              variant="secondary"
              value={form.voiceId || null}
              onChange={(selected) => {
                setField('voiceId', typeof selected === 'string' ? selected : '');
              }}
            >
              <Label>{t('members.create_voice')}</Label>
              <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {voices.map((voice) => (
                    <ListBox.Item key={voice.id} id={voice.id} textValue={voice.name}>
                      {voice.name}<ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          )}
          {error && <p className="text-danger text-sm">{error}</p>}
          </Modal.Body>
          <Modal.Footer>
          <Button variant="tertiary" onPress={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onPress={handleSubmit} isPending={saving} isDisabled={!isValid}>
            {({ isPending }) => <>{isPending && <Spinner color="current" size="sm" />}{t('members.create_btn')}</>}
          </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
