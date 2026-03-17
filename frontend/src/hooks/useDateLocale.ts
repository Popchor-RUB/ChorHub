import { useTranslation } from 'react-i18next';

/** Returns the BCP-47 locale string matching the current UI language. */
export function useDateLocale(): string {
  const { i18n } = useTranslation();
  return i18n.language.startsWith('en') ? 'en-GB' : 'de-DE';
}
