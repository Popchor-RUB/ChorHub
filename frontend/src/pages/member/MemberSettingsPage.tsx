import { useState } from 'react';
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
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

      <div className="bg-background rounded-xl border border-divider p-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium">{t('nav.notifications')}</p>
          <p className="mt-1 text-xs text-default-500">
            {denied ? t('notifications.blocked_help') : t('notifications.member_help')}
          </p>
        </div>
        <Switch
          isSelected={isSubscribed}
          isDisabled={denied || isLoading}
          onValueChange={handleNotificationToggle}
          aria-label={t('nav.notifications')}
        />
      </div>

      <div className="bg-background rounded-xl border border-divider p-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium">{t('settings.language')}</p>
        </div>
        <LanguageSwitcher />
      </div>
      </div>

      <Modal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} size="sm">
        <ModalContent>
          <ModalHeader>{t('notifications.disable_title')}</ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-600">
              {t('notifications.disable_body')}
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setConfirmOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button color="danger" onPress={handleConfirmUnsubscribe}>
              {t('notifications.deactivate')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
