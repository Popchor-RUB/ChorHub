import { useEffect, useState } from 'react';
import {
  Button,
  Modal,
  Radio,
  RadioGroup,
  Spinner,
  useOverlayState,
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
  const [showCalendarAdvanced, setShowCalendarAdvanced] = useState(false);

  const [availableVoices, setAvailableVoices] = useState<ChoirVoice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [savingVoice, setSavingVoice] = useState(false);
  const voiceModal = useOverlayState();
  const calendarModal = useOverlayState();
  const { t } = useTranslation();

  const calendarIcsUrl = memberCalendarApi.getIcsUrl();
  const calendarWebcalUrl = memberCalendarApi.getWebcalUrl();
  const calendarGoogleUrl = memberCalendarApi.getGoogleCalendarSubscribeUrl();
  const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const isAppleDevice = /iphone|ipad|ipod|macintosh/i.test(userAgent);
  const primaryCalendarUrl = isAppleDevice ? calendarWebcalUrl : calendarGoogleUrl;
  const secondaryCalendarUrl = isAppleDevice ? calendarGoogleUrl : calendarWebcalUrl;

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
    voiceModal.open();
  };

  const handleSaveVoice = async () => {
    setSavingVoice(true);
    try {
      const res = await membersApi.updateVoice(selectedVoiceId);
      setMember(res.data as Member);
      voiceModal.close();
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

  const closeCalendarModal = () => {
    setShowCalendarAdvanced(false);
    calendarModal.close();
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

  const recordedPast = past.filter((r) => !r.isOptional && r.myAttended != null);
  const attended = rehearsals.filter((r) => !r.isOptional && r.myAttended === true).length;
  const excused = recordedPast.filter((r) => r.myAttended === false && r.myPlan === 'DECLINED').length;
  const unexcused = recordedPast.filter((r) => r.myAttended === false && r.myPlan !== 'DECLINED').length;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t('rehearsals.title')}</h1>

      {/* Voice banner */}
      <div className="flex items-center gap-3 px-4 py-3 bg-surface-secondary dark:bg-surface-secondary/10 rounded-xl text-sm border border-border">
        <span className="text-muted">{t('voice.your_voice')}</span>
        <span className="font-medium flex-1">
          {member?.choirVoice?.name ?? t('voice.not_set')}
        </span>
        <Button size="sm" variant="tertiary" onPress={openVoiceModal}>
          {t('voice.change')}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-success/25 bg-success-soft p-3">
          <span className="text-2xl font-bold text-success">{attended}</span>
          <span className="text-xs text-success-soft-foreground dark:text-success-400 text-center">{t('rehearsals.present')}</span>
        </div>
        <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-warning/25 bg-warning-soft p-3">
          <span className="text-2xl font-bold text-warning">{excused}</span>
          <span className="text-xs text-warning-soft-foreground dark:text-warning-400 text-center">{t('rehearsals.excused')}</span>
        </div>
        <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-danger/25 bg-danger-soft p-3">
          <span className="text-2xl font-bold text-danger">{unexcused}</span>
          <span className="text-xs text-danger-soft-foreground dark:text-danger-400 text-center leading-tight">{t('rehearsals.unexcused')}</span>
        </div>
      </div>

      {/* Upcoming rehearsals */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-muted">
            {t('rehearsals.upcoming_count', { count: upcoming.length })}
          </h2>
          <Button
            size="sm"
            variant="tertiary"
            onPress={calendarModal.open}
          >
            {t('rehearsals.calendar_button')}
          </Button>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-muted text-sm">{t('rehearsals.no_upcoming')}</p>
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
          <h2 className="text-base font-semibold text-muted mb-3">
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
      <Modal.Backdrop isOpen={voiceModal.isOpen} onOpenChange={voiceModal.setOpen}>
        <Modal.Container>
          <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header><Modal.Heading>{t('voice.change_title')}</Modal.Heading></Modal.Header>
          <Modal.Body>
            {availableVoices.length === 0 ? (
              <p className="text-muted text-sm">{t('voice.no_voices')}</p>
            ) : (
              <RadioGroup className="flex flex-col gap-2" value={selectedVoiceId ?? undefined} onChange={setSelectedVoiceId}>
                {availableVoices.map((v) => (
                  <Radio
                    key={v.id}
                    value={v.id}
                    className="rounded-xl border border-border bg-surface-secondary p-3"
                  >
                    <Radio.Content>
                    <Radio.Control><Radio.Indicator /></Radio.Control>
                    <span className="flex-1">{v.name}</span>
                    {v.memberCount !== undefined && (
                      <span className="text-xs text-muted">
                        {v.memberCount}{' '}
                        {t(v.memberCount === 1 ? 'common.member_one' : 'common.member_other')}
                      </span>
                    )}
                    </Radio.Content>
                  </Radio>
                ))}
              </RadioGroup>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="tertiary" onPress={voiceModal.close}>{t('common.cancel')}</Button>
            <Button isPending={savingVoice} onPress={handleSaveVoice}>
              {({ isPending }) => <>{isPending && <Spinner color="current" size="sm" />}{t('common.save')}</>}
            </Button>
          </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {/* Calendar subscribe modal */}
      <Modal.Backdrop isOpen={calendarModal.isOpen} onOpenChange={(open) => { if (!open) closeCalendarModal(); }}>
        <Modal.Container>
          <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header><Modal.Heading>{t('rehearsals.calendar_title')}</Modal.Heading></Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            <p className="text-sm text-muted">{t('rehearsals.calendar_hint')}</p>
            <div className="flex flex-col gap-1">
              <Button
                fullWidth
                isDisabled={!primaryCalendarUrl}
                onPress={() => {
                  if (!primaryCalendarUrl) return;
                  window.open(primaryCalendarUrl, '_blank', 'noopener,noreferrer');
                }}
              >
                {isAppleDevice
                  ? t('rehearsals.calendar_subscribe')
                  : t('rehearsals.calendar_add_google')}
              </Button>
              <p className="text-xs text-muted">
                {isAppleDevice
                  ? t('rehearsals.calendar_recommended_apple')
                  : t('rehearsals.calendar_recommended_google')}
              </p>
            </div>
            <Button
              variant="tertiary"
              size="sm"
              className="self-start font-medium"
              onPress={() => setShowCalendarAdvanced((prev) => !prev)}
            >
              {showCalendarAdvanced
                ? t('rehearsals.calendar_more_options_hide')
                : t('rehearsals.calendar_more_options_show')}
            </Button>
            {showCalendarAdvanced && (
              <div className="flex flex-col gap-2 border-t border-separator pt-3">
                <p className="text-xs text-muted">{t('rehearsals.calendar_more_options_hint')}</p>
                <Button
                  variant="tertiary"
                  isDisabled={!secondaryCalendarUrl}
                  onPress={() => {
                    if (!secondaryCalendarUrl) return;
                    window.open(secondaryCalendarUrl, '_blank', 'noopener,noreferrer');
                  }}
                >
                  {isAppleDevice
                    ? t('rehearsals.calendar_add_google')
                    : t('rehearsals.calendar_subscribe')}
                </Button>
                <Button
                  variant="tertiary"
                  isDisabled={!calendarIcsUrl}
                  onPress={handleCopyCalendarLink}
                >
                  {calendarCopied ? t('rehearsals.calendar_copied') : t('rehearsals.calendar_copy')}
                </Button>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="tertiary" onPress={closeCalendarModal}>
              {t('common.close')}
            </Button>
          </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
