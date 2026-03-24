import { useEffect, useState } from 'react';
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
  useDisclosure,
} from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { rehearsalsApi, membersApi, choirVoicesApi, memberCalendarApi } from '../../services/api';
import { RehearsalCard } from '../../components/rehearsal/RehearsalCard';
import type { ChoirVoice, Member, Rehearsal } from '../../types';

export function RehearsalsPage() {
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllRehearsals, setShowAllRehearsals] = useState(false);
  const [calendarCopied, setCalendarCopied] = useState(false);

  const [availableVoices, setAvailableVoices] = useState<ChoirVoice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [savingVoice, setSavingVoice] = useState(false);
  const voiceModal = useDisclosure();
  const calendarModal = useDisclosure();
  const { t } = useTranslation();

  const calendarIcsUrl = memberCalendarApi.getIcsUrl();
  const calendarWebcalUrl = memberCalendarApi.getWebcalUrl();

  const loadData = async () => {
    const [rehearsalRes, memberRes] = await Promise.all([
      rehearsalsApi.getAllForMember().catch(() => ({ data: [] })),
      membersApi.me().catch(() => ({ data: null })),
    ]);
    setRehearsals(rehearsalRes.data as Rehearsal[]);
    setMember(memberRes.data as Member);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const openVoiceModal = async () => {
    setSelectedVoiceId(member?.choirVoice?.id ?? null);
    const res = await choirVoicesApi.list().catch(() => ({ data: [] }));
    setAvailableVoices(res.data as ChoirVoice[]);
    voiceModal.onOpen();
  };

  const handleSaveVoice = async () => {
    setSavingVoice(true);
    try {
      const res = await membersApi.updateVoice(selectedVoiceId);
      setMember(res.data as Member);
      voiceModal.onClose();
    } finally {
      setSavingVoice(false);
    }
  };

  const handleCopyCalendarLink = async () => {
    if (!calendarIcsUrl) return;
    try {
      await navigator.clipboard.writeText(calendarIcsUrl);
      setCalendarCopied(true);
      window.setTimeout(() => setCalendarCopied(false), 2500);
    } catch {
      setCalendarCopied(false);
    }
  };

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const upcoming = rehearsals.filter((r) => new Date(r.date) >= startOfToday).reverse();
  const past = rehearsals.filter((r) => new Date(r.date) < startOfToday);
  const visibleUpcoming = showAllRehearsals ? upcoming : upcoming.slice(0, 4);
  const hasHiddenRehearsals = upcoming.length > visibleUpcoming.length;

  if (loading) {
    return <div className="flex justify-center pt-16"><Spinner size="lg" /></div>;
  }

  const recorded = past.filter((r) => r.myAttended != null);
  const attended = recorded.filter((r) => r.myAttended === true).length;
  const excused = recorded.filter((r) => r.myAttended === false && r.myPlan === 'DECLINED').length;
  const unexcused = recorded.filter((r) => r.myAttended === false && r.myPlan !== 'DECLINED').length;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t('rehearsals.title')}</h1>

      {/* Voice banner */}
      <div className="flex items-center gap-3 px-4 py-3 bg-default-100 dark:bg-default-100/10 rounded-xl text-sm border border-default-200">
        <span className="text-default-500">{t('voice.your_voice')}</span>
        <span className="font-medium flex-1">
          {member?.choirVoice?.name ?? t('voice.not_set')}
        </span>
        <Button size="sm" variant="flat" onPress={openVoiceModal}>
          {t('voice.change')}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col items-center justify-center gap-1 bg-success-50 dark:bg-success-50/10 rounded-xl p-3 border border-success-200 dark:border-success-800">
          <span className="text-2xl font-bold text-success">{attended}</span>
          <span className="text-xs text-success-700 dark:text-success-400 text-center">{t('rehearsals.present')}</span>
        </div>
        <div className="flex flex-col items-center justify-center gap-1 bg-warning-50 dark:bg-warning-50/10 rounded-xl p-3 border border-warning-200 dark:border-warning-800">
          <span className="text-2xl font-bold text-warning">{excused}</span>
          <span className="text-xs text-warning-700 dark:text-warning-400 text-center">{t('rehearsals.excused')}</span>
        </div>
        <div className="flex flex-col items-center justify-center gap-1 bg-danger-50 dark:bg-danger-50/10 rounded-xl p-3 border border-danger-200 dark:border-danger-800">
          <span className="text-2xl font-bold text-danger">{unexcused}</span>
          <span className="text-xs text-danger-700 dark:text-danger-400 text-center leading-tight">{t('rehearsals.unexcused')}</span>
        </div>
      </div>

      {/* Upcoming rehearsals */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-default-600">
            {t('rehearsals.upcoming_count', { count: upcoming.length })}
          </h2>
          <Button
            size="sm"
            variant="flat"
            onPress={calendarModal.onOpen}
          >
            {t('rehearsals.calendar_button')}
          </Button>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-default-400 text-sm">{t('rehearsals.no_upcoming')}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {visibleUpcoming.map((r) => (
              <RehearsalCard key={r.id} rehearsal={r} onUpdated={loadData} />
            ))}
          </div>
        )}
        {!showAllRehearsals && hasHiddenRehearsals && (
          <div className="mt-3 flex justify-center">
            <Button
              color="primary"
              onPress={() => setShowAllRehearsals(true)}
            >
              {t('rehearsals.show_all')}
            </Button>
          </div>
        )}
      </section>

      {/* Past rehearsals */}
      {past.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-default-400 mb-3">
            {t('rehearsals.past_count', { count: past.length })}
          </h2>
          <div className="flex flex-col gap-3">
            {past.map((r) => (
              <RehearsalCard
                key={r.id}
                rehearsal={r}
                onUpdated={loadData}
                readOnly
              />
            ))}
          </div>
        </section>
      )}

      {/* Voice change modal */}
      <Modal isOpen={voiceModal.isOpen} onClose={voiceModal.onClose}>
        <ModalContent>
          <ModalHeader>{t('voice.change_title')}</ModalHeader>
          <ModalBody>
            {availableVoices.length === 0 ? (
              <p className="text-default-400 text-sm">{t('voice.no_voices')}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {availableVoices.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVoiceId(v.id)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm border transition-colors text-left ${
                      selectedVoiceId === v.id
                        ? 'bg-primary-50 border-primary-400 text-primary font-semibold'
                        : 'bg-default-50 border-default-200 hover:bg-default-100'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      selectedVoiceId === v.id ? 'border-primary bg-primary' : 'border-default-400'
                    }`}>
                      {selectedVoiceId === v.id && <span className="w-2 h-2 rounded-full bg-white" />}
                    </span>
                    <span className="flex-1">{v.name}</span>
                    {v.memberCount !== undefined && (
                      <span className="text-xs text-default-400">
                        {v.memberCount}{' '}
                        {t(v.memberCount === 1 ? 'common.member_one' : 'common.member_other')}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={voiceModal.onClose}>{t('common.cancel')}</Button>
            <Button color="primary" isLoading={savingVoice} onPress={handleSaveVoice}>
              {t('common.save')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Calendar subscribe modal */}
      <Modal isOpen={calendarModal.isOpen} onClose={calendarModal.onClose}>
        <ModalContent>
          <ModalHeader>{t('rehearsals.calendar_title')}</ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-500">{t('rehearsals.calendar_hint')}</p>
          </ModalBody>
          <ModalFooter>
            <Button
              color="primary"
              isDisabled={!calendarWebcalUrl}
              onPress={() => {
                if (!calendarWebcalUrl) return;
                window.open(calendarWebcalUrl, '_blank', 'noopener,noreferrer');
              }}
            >
              {t('rehearsals.calendar_subscribe')}
            </Button>
            <Button
              variant="flat"
              isDisabled={!calendarIcsUrl}
              onPress={handleCopyCalendarLink}
            >
              {calendarCopied ? t('rehearsals.calendar_copied') : t('rehearsals.calendar_copy')}
            </Button>
            <Button variant="flat" onPress={calendarModal.onClose}>
              {t('common.close')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
