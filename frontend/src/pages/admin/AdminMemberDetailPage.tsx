import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input,
  Select,
  SelectItem,
  Spinner,
} from '@heroui/react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { MemberRehearsalOverview } from '../../components/member/MemberRehearsalOverview';
import { adminMembersApi, attendanceApi, choirVoicesApi } from '../../services/api';
import { useDateLocale } from '../../hooks/useDateLocale';
import { adminInputClassNames, adminSelectClassNames } from '../../styles/adminFormStyles';
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

  const cycleUpcomingPlan = (current: 'CONFIRMED' | 'DECLINED' | null): 'CONFIRMED' | 'DECLINED' | null => {
    if (current === 'CONFIRMED') return 'DECLINED';
    if (current === 'DECLINED') return null;
    return 'CONFIRMED';
  };

  const cycleOptionalPlan = (current: 'CONFIRMED' | 'DECLINED' | null): 'CONFIRMED' | 'DECLINED' | null => {
    if (current === 'CONFIRMED') return 'DECLINED';
    if (current === 'DECLINED') return null;
    return 'CONFIRMED';
  };

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

  const handleToggleUpcomingPlan = async (r: MemberRehearsalEntry) => {
    if (!member || rehearsalSaving) return;
    const newResponse = r.isOptional ? cycleOptionalPlan(r.plan) : cycleUpcomingPlan(r.plan);

    setRehearsals((prev) => prev.map((x) => (x.id === r.id ? { ...x, plan: newResponse } : x)));
    setRehearsalSaving(r.id);
    try {
      await adminMembersApi.setAttendancePlan(member.id, r.id, newResponse);
    } catch {
      setRehearsals((prev) => prev.map((x) => (x.id === r.id ? { ...x, plan: r.plan } : x)));
      setError(t('attendance.save_failed'));
    } finally {
      setRehearsalSaving(null);
    }
  };

  const handleTogglePastAttendance = async (r: MemberRehearsalEntry) => {
    if (!member || rehearsalSaving) return;
    const nextAttended = !r.attended;

    setRehearsals((prev) => prev.map((x) => (x.id === r.id ? { ...x, attended: nextAttended } : x)));
    setRehearsalSaving(r.id);
    try {
      await attendanceApi.setRecord(r.id, member.id, nextAttended);
    } catch {
      setRehearsals((prev) => prev.map((x) => (x.id === r.id ? { ...x, attended: r.attended } : x)));
      setError(t('attendance.save_failed'));
    } finally {
      setRehearsalSaving(null);
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
        <Link className="text-sm text-primary hover:underline" to="/admin/mitglieder">
          {t('common.back')}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">{t('members.detail_title')}</h1>
        <p className="text-default-500">{member.firstName} {member.lastName}</p>
      </div>

      <Card className="border border-divider bg-content1 shadow-sm">
        <CardBody className="grid gap-4 md:grid-cols-2">
          <Input
            label={t('members.create_first_name')}
            value={form.firstName}
            onValueChange={(v) => setForm((prev) => ({ ...prev, firstName: v }))}
            classNames={adminInputClassNames}
            data-testid="member-detail-first-name"
          />
          <Input
            label={t('members.create_last_name')}
            value={form.lastName}
            onValueChange={(v) => setForm((prev) => ({ ...prev, lastName: v }))}
            classNames={adminInputClassNames}
            data-testid="member-detail-last-name"
          />
          <div className="grid gap-3 md:col-span-2 md:grid-cols-[1fr_auto]">
            <Input
              label={t('members.create_email')}
              type="email"
              value={form.email}
              onValueChange={(v) => setForm((prev) => ({ ...prev, email: v }))}
              classNames={adminInputClassNames}
              data-testid="member-detail-email"
            />
            <div className="self-end">
              <Dropdown>
                <DropdownTrigger>
                  <Button
                    variant="flat"
                    endContent={<ChevronDownIcon className="h-4 w-4" />}
                    isLoading={mailSending !== null}
                    isDisabled={mailSending !== null}
                    data-testid="member-detail-email-menu"
                  >
                    {t('members.detail_mail_actions')}
                  </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label={t('members.detail_mail_actions')}>
                  <DropdownItem key="invite" onPress={() => handleSendMail('invite')}>
                    {t('members.detail_send_invite')}
                  </DropdownItem>
                  <DropdownItem key="login" onPress={() => handleSendMail('login')}>
                    {t('members.detail_send_login')}
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </div>
          </div>

          <Select
            label={t('members.create_voice')}
            selectedKeys={form.voiceId ? new Set([form.voiceId]) : new Set()}
            classNames={adminSelectClassNames}
            onSelectionChange={(keys) => {
              const selected = [...keys][0];
              setForm((prev) => ({ ...prev, voiceId: typeof selected === 'string' ? selected : '' }));
            }}
            data-testid="member-detail-voice"
          >
            {voices.map((v) => (
              <SelectItem key={v.id}>{v.name}</SelectItem>
            ))}
          </Select>

          <div className="flex items-center gap-3 md:justify-end">
            <Button
              color="primary"
              onPress={handleSave}
              isLoading={saving}
              isDisabled={!dirty || saving}
              data-testid="member-detail-save"
            >
              {t('common.save')}
            </Button>
            {saved && <span className="text-success text-sm">{t('common.saved')}</span>}
            {error && <span className="text-danger text-sm">{error}</span>}
          </div>
        </CardBody>
      </Card>

      <Card className="border border-divider bg-content1 shadow-sm">
        <CardBody>
          <MemberRehearsalOverview
            rehearsals={rehearsals}
            dateLocale={dateLocale}
            editMode={editMode}
            setEditMode={setEditMode}
            savingId={rehearsalSaving}
            showAllUpcoming={showAllUpcoming}
            setShowAllUpcoming={setShowAllUpcoming}
            onToggleUpcomingPlan={handleToggleUpcomingPlan}
            onTogglePastAttendance={handleTogglePastAttendance}
            title={t('members.detail_rehearsals_title')}
            className="gap-4"
            testIdPrefix="member-detail"
          />
        </CardBody>
      </Card>
    </div>
  );
}
