import { useEffect, useState } from 'react';
import { Checkbox, Spinner, Tab, Tabs } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { generalInfoApi } from '../../services/api';
import { MarkdownEditor } from '../../components/info/MarkdownEditor';
import { AdminPersonalInfoPanel } from '../../components/info/AdminPersonalInfoPanel';

export function GeneralInfoPage() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sendPush, setSendPush] = useState(false);
  const [selectedTab, setSelectedTab] = useState('general');
  const { t } = useTranslation();

  useEffect(() => {
    generalInfoApi.get().then((res) => {
      setContent(res.data.markdownContent ?? '');
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await generalInfoApi.update(content, sendPush);
      setSaved(true);
      setSendPush(false);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center pt-8"><Spinner /></div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t('info.admin_title')}</h1>
      <Tabs
        selectedKey={selectedTab}
        onSelectionChange={(key) => setSelectedTab(String(key))}
        aria-label={t('info.admin_segment_aria')}
        variant="underlined"
      >
        <Tab key="general" title={t('info.member_general_tab')}>
          <div className="mt-2 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-default-500">{t('info.description')}</p>
              {saved && <span className="text-success text-sm font-medium">{t('common.saved')}</span>}
            </div>
            <MarkdownEditor
              value={content}
              onChange={setContent}
              onSave={handleSave}
              saving={saving}
            />
            <Checkbox isSelected={sendPush} onValueChange={setSendPush}>
              {t('info.send_push')}
            </Checkbox>
          </div>
        </Tab>
        <Tab key="personal" title={t('info.member_personal_tab')}>
          <div className="mt-2">
            <AdminPersonalInfoPanel />
          </div>
        </Tab>
      </Tabs>
    </div>
  );
}
