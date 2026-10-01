import { useTranslation } from 'react-i18next';
import { AdminMailTemplatesSection } from '../../components/admin/mail-templates/AdminMailTemplatesSection';

export function AdminMailTemplatesPage() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
      <AdminMailTemplatesSection />
    </div>
  );
}
