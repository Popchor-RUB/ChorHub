import { useTranslation } from 'react-i18next';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language.startsWith('en') ? 'en' : 'de';

  const toggle = () => {
    const next = current === 'de' ? 'en' : 'de';
    void i18n.changeLanguage(next);
  };

  return (
    <button
      onClick={toggle}
      aria-label={current === 'de' ? 'Switch to English' : 'Zu Deutsch wechseln'}
      title={current === 'de' ? 'Switch to English' : 'Zu Deutsch wechseln'}
      className="px-2 py-1 text-xs font-medium rounded-md bg-default-100 hover:bg-default-200 transition-colors text-default-600"
    >
      {current === 'de' ? 'EN' : 'DE'}
    </button>
  );
}
