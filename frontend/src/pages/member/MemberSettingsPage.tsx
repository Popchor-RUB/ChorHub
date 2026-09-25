import { useState } from 'react';
import {
  Button,
  Modal,
  Switch,
} from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';

export function MemberSettingsPage() {
  const { t } = useTranslation();
  const { permission, isSubscribed, subscribe, unsubscribe, isLoading } = usePushNotifications();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const denied = permission === 'denied';

  const handleNotificationToggle = (next: boolean) => {
    if (denied || isLoading) return;
    if (next) {
      void subscribe();
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirmUnsubscribe = () => {
    setConfirmOpen(false);
    void unsubscribe();
  };

  return (
    <>
      <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t('settings.title')}</h1>

      <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4 shadow-surface">
        <div className="min-w-0">
          <p className="font-medium">{t('nav.notifications')}</p>
          <p className="mt-1 text-xs text-muted">
            {denied ? t('notifications.blocked_help') : t('notifications.member_help')}
          </p>
        </div>
        <Switch
          isSelected={isSubscribed}
          isDisabled={denied || isLoading}
          onChange={handleNotificationToggle}
          aria-label={t('nav.notifications')}
        >
          <Switch.Content>
            <Switch.Control><Switch.Thumb /></Switch.Control>
          </Switch.Content>
        </Switch>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4 shadow-surface">
        <div className="min-w-0">
          <p className="font-medium">{t('settings.language')}</p>
        </div>
        <LanguageSwitcher />
      </div>
      </div>

      <Modal.Backdrop isOpen={confirmOpen} onOpenChange={setConfirmOpen}>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header><Modal.Heading>{t('notifications.disable_title')}</Modal.Heading></Modal.Header>
            <Modal.Body>
            <p className="text-sm text-muted">
              {t('notifications.disable_body')}
            </p>
            </Modal.Body>
            <Modal.Footer>
            <Button variant="tertiary" onPress={() => setConfirmOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onPress={handleConfirmUnsubscribe}>
              {t('notifications.deactivate')}
            </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}
