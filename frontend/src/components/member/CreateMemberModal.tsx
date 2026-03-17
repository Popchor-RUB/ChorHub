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
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalContent>
        <ModalHeader>{t('members.create_title')}</ModalHeader>
        <ModalBody className="flex flex-col gap-3">
          <div className="flex gap-3">
            <Input
              label={t('members.create_first_name')}
              value={form.firstName}
              onValueChange={(v) => setField('firstName', v)}
              isRequired
              autoFocus
            />
            <Input
              label={t('members.create_last_name')}
              value={form.lastName}
              onValueChange={(v) => setField('lastName', v)}
              isRequired
            />
          </div>
          <Input
            label={t('members.create_email')}
            type="email"
            value={form.email}
            onValueChange={(v) => setField('email', v)}
            isRequired
          />
          {voices.length > 0 && (
            <Select
              label={t('members.create_voice')}
              selectedKeys={form.voiceId ? new Set([form.voiceId]) : new Set()}
              onSelectionChange={(keys) => {
                const selected = [...keys][0];
                setField('voiceId', typeof selected === 'string' ? selected : '');
              }}
            >
              {voices.map((v) => (
                <SelectItem key={v.id}>{v.name}</SelectItem>
              ))}
            </Select>
          )}
          {error && <p className="text-danger text-sm">{error}</p>}
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            color="primary"
            onPress={handleSubmit}
            isLoading={saving}
            isDisabled={!isValid}
          >
            {t('members.create_btn')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
