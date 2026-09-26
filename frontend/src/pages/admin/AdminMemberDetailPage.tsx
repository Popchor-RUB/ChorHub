import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Dropdown,
  Input,
  Label,
  ListBox,
  Select,
  Spinner,
  TextField,
} from '@heroui/react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { MemberRehearsalOverview } from '../../components/member/MemberRehearsalOverview';
import { adminMembersApi, choirVoicesApi } from '../../services/api';
import { useDateLocale } from '../../hooks/useDateLocale';
import type { AdminMemberDetail, ChoirVoice, MemberRehearsalEntry } from '../../types';

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  voiceId: string;
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

export function AdminMemberDetailPage() {
  const { memberId = '' } = useParams<{ memberId: string }>();
  const { t } = useTranslation();
  const dateLocale = useDateLocale();

  const [member, setMember] = useState<AdminMemberDetail | null>(null);
  const [rehearsals, setRehearsals] = useState<MemberRehearsalEntry[]>([]);
  const [voices, setVoices] = useState<ChoirVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rehearsalSaving, setRehearsalSaving] = useState<string | null>(null);
  const [mailSending, setMailSending] = useState<'invite' | 'login' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [voiceAdminVoiceIds, setVoiceAdminVoiceIds] = useState<string[]>([]);
  const [voiceAdminSaving, setVoiceAdminSaving] = useState(false);
  const [voiceAdminSaved, setVoiceAdminSaved] = useState(false);

  const [form, setForm] = useState<FormState>({
    firstName: '',
    lastName: '',
    email: '',
    voiceId: '',
  });
  const [initialForm, setInitialForm] = useState<FormState | null>(null);

  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    if (!memberId) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [memberRes, rehearsalsRes, voicesRes] = await Promise.all([
          adminMembersApi.get(memberId),
          adminMembersApi.rehearsals(memberId),
          choirVoicesApi.list(),
        ]);
        const memberData = memberRes.data as AdminMemberDetail;
        setMember(memberData);
        setRehearsals(rehearsalsRes.data as MemberRehearsalEntry[]);
        setVoices(voicesRes.data as ChoirVoice[]);
        setVoiceAdminVoiceIds((memberData.voiceAdminVoices ?? []).map((voice) => voice.id));
        const nextForm = {
          firstName: memberData.firstName,
          lastName: memberData.lastName,
          email: memberData.email,
          voiceId: memberData.choirVoice?.id ?? '',
        };
        setForm(nextForm);
        setInitialForm(nextForm);
      } catch (e: unknown) {
        setError(getErrorMessage(e, t('common.error_generic')));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [memberId, t]);

  const dirty = useMemo(() => {
    if (!initialForm) return false;
    return (
      initialForm.firstName !== form.firstName
      || initialForm.lastName !== form.lastName
      || initialForm.email !== form.email
      || initialForm.voiceId !== form.voiceId
    );
  }, [form, initialForm]);

  const handleSave = async () => {
    if (!member || !dirty || saving) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await adminMembersApi.update(member.id, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        voiceId: form.voiceId || null,
      });
      const updated = res.data as AdminMemberDetail;
      setMember(updated);
      const nextForm = {
        firstName: updated.firstName,
        lastName: updated.lastName,
        email: updated.email,
        voiceId: updated.choirVoice?.id ?? '',
      };
      setForm(nextForm);
      setInitialForm(nextForm);
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('common.error_generic')));
    } finally {
      setSaving(false);
    }
  };

  const handleSendMail = async (mode: 'invite' | 'login') => {
    if (!member || mailSending) return;
    setMailSending(mode);
    setError(null);
    setSaved(false);
    try {
      if (mode === 'invite') {
        await adminMembersApi.sendInvite(member.id);
      } else {
        await adminMembersApi.sendLogin(member.id);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('common.error_generic')));
    } finally {
      setMailSending(null);
    }
  };

  const saveVoiceAdminGrants = async () => {
    if (!member || voiceAdminSaving) return;
    setVoiceAdminSaving(true);
    setVoiceAdminSaved(false);
    setError(null);
    try {
      const response = await adminMembersApi.setVoiceAdminVoices(member.id, voiceAdminVoiceIds);
      setMember({ ...member, voiceAdminVoices: response.data.voiceAdminVoices });
      setVoiceAdminVoiceIds(response.data.voiceAdminVoices.map((voice) => voice.id));
      setVoiceAdminSaved(true);
      setTimeout(() => setVoiceAdminSaved(false), 2200);
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('common.error_generic')));
    } finally {
      setVoiceAdminSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center pt-8"><Spinner /></div>;
  }

  if (!member) {
    return <p className="text-danger">{error ?? t('common.error_generic')}</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 pb-8" data-testid="member-detail-page">
      <div className="flex flex-col gap-1">
        <Link className="text-sm text-accent hover:underline" to="/admin/mitglieder">
          {t('common.back')}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">{t('members.detail_title')}</h1>
        <p className="text-muted">{member.firstName} {member.lastName}</p>
      </div>

      <Card>
        <Card.Content className="grid gap-4 md:grid-cols-2">
          <TextField
            className="w-full"
            variant="secondary"
            value={form.firstName}
            onChange={(value) => setForm((prev) => ({ ...prev, firstName: value }))}
            data-testid="member-detail-first-name"
          >
            <Label>{t('members.create_first_name')}</Label><Input />
          </TextField>
          <TextField
            className="w-full"
            variant="secondary"
            value={form.lastName}
            onChange={(value) => setForm((prev) => ({ ...prev, lastName: value }))}
            data-testid="member-detail-last-name"
          >
            <Label>{t('members.create_last_name')}</Label><Input />
          </TextField>
          <div className="grid gap-3 md:col-span-2 md:grid-cols-[1fr_auto]">
            <TextField
              className="w-full"
              variant="secondary"
              type="email"
              value={form.email}
              onChange={(value) => setForm((prev) => ({ ...prev, email: value }))}
              data-testid="member-detail-email"
            >
              <Label>{t('members.create_email')}</Label><Input />
            </TextField>
            <div className="self-end">
              <Dropdown>
                <Button
                  variant="tertiary"
                  isPending={mailSending !== null}
                  isDisabled={mailSending !== null}
                  data-testid="member-detail-email-menu"
                >
                  {mailSending !== null && <Spinner color="current" size="sm" />}
                  {t('members.detail_mail_actions')}
                  <ChevronDownIcon className="h-4 w-4" />
                </Button>
                <Dropdown.Popover>
                  <Dropdown.Menu aria-label={t('members.detail_mail_actions')}>
                    <Dropdown.Item id="invite" textValue={t('members.detail_send_invite')} onAction={() => handleSendMail('invite')}>
                      <Label>{t('members.detail_send_invite')}</Label>
                    </Dropdown.Item>
                    <Dropdown.Item id="login" textValue={t('members.detail_send_login')} onAction={() => handleSendMail('login')}>
                      <Label>{t('members.detail_send_login')}</Label>
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            </div>
          </div>

          <Select
            variant="secondary"
            value={form.voiceId || null}
            onChange={(selected) => {
              setForm((prev) => ({ ...prev, voiceId: typeof selected === 'string' ? selected : '' }));
            }}
            data-testid="member-detail-voice"
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

          <div className="flex items-center gap-3 md:justify-end">
            <Button
              onPress={handleSave}
              isPending={saving}
              isDisabled={!dirty || saving}
              data-testid="member-detail-save"
            >
              {({ isPending }) => <>{isPending && <Spinner color="current" size="sm" />}{t('common.save')}</>}
            </Button>
            {saved && <span className="text-success text-sm">{t('common.saved')}</span>}
            {error && <span className="text-danger text-sm">{error}</span>}
          </div>
        </Card.Content>
      </Card>

      <Card data-testid="voice-admin-grants">
        <Card.Header>
          <Card.Title>{t('members.voice_admin_grants_title')}</Card.Title>
          <Card.Description>{t('members.voice_admin_grants_description')}</Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            {voices.map((voice) => (
              <Checkbox
                key={voice.id}
                variant='secondary'
                isSelected={voiceAdminVoiceIds.includes(voice.id)}
                onChange={(selected) => setVoiceAdminVoiceIds((current) => selected
                  ? [...current, voice.id]
                  : current.filter((id) => id !== voice.id))}
              >
                <Checkbox.Content>
                  <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
                  {voice.name}
                </Checkbox.Content>
              </Checkbox>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Button
              onPress={() => void saveVoiceAdminGrants()}
              isPending={voiceAdminSaving}
              isDisabled={voiceAdminSaving}
              data-testid="voice-admin-grants-save"
            >
              {({ isPending }) => <>{isPending && <Spinner color="current" size="sm" />}{t('common.save')}</>}
            </Button>
            {voiceAdminSaved && <span className="text-success text-sm">{t('common.saved')}</span>}
          </div>
        </Card.Content>
      </Card>

      <Card>
        <Card.Content>
          <MemberRehearsalOverview
            rehearsals={rehearsals}
            dateLocale={dateLocale}
            editMode={editMode}
            setEditMode={setEditMode}
            memberId={member.id}
            setRehearsals={setRehearsals}
            savingId={rehearsalSaving}
            setSavingId={setRehearsalSaving}
            showAllUpcoming={showAllUpcoming}
            setShowAllUpcoming={setShowAllUpcoming}
            onSaveError={() => setError(t('attendance.save_failed'))}
            title={t('members.detail_rehearsals_title')}
            className="gap-4"
            testIdPrefix="member-detail"
          />
        </Card.Content>
      </Card>
    </div>
  );
}
