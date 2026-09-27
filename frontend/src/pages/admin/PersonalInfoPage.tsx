import { useTranslation } from 'react-i18next';
import { AdminPersonalInfoPanel } from '../../components/info/AdminPersonalInfoPanel';

export function PersonalInfoPage() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t('info.member_personal_tab')}</h1>
      <AdminPersonalInfoPanel />
    </div>
  );
}
