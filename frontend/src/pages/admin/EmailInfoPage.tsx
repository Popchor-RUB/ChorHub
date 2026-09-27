import { useTranslation } from 'react-i18next';

export function EmailInfoPage() {
  const { t } = useTranslation();

  return <h1 className="text-2xl font-bold">{t('nav.email')}</h1>;
}
