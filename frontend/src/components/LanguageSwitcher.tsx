import { Button } from '@heroui/react';
import { useTranslation } from 'react-i18next';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language.startsWith('en') ? 'en' : 'de';

  const toggle = () => {
    const next = current === 'de' ? 'en' : 'de';
    void i18n.changeLanguage(next);
  };

  return (
    <Button
      size="sm"
      variant="tertiary"
      onPress={toggle}
      aria-label={current === 'de' ? 'Switch to English' : 'Zu Deutsch wechseln'}
      className="min-w-0 px-2 text-xs"
    >
      {current === 'de' ? 'EN' : 'DE'}
    </Button>
  );
}
