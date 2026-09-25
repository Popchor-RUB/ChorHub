import { useEffect, useState } from 'react';
import { Checkbox, Spinner, Tabs } from '@heroui/react';
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
        variant="secondary"
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label={t('info.admin_segment_aria')}>
            <Tabs.Tab id="general">
              {t('info.member_general_tab')}
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="personal">
              {t('info.member_personal_tab')}
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel id="general">
          <div className="mt-2 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted">{t('info.description')}</p>
              {saved && <span className="text-success text-sm font-medium">{t('common.saved')}</span>}
            </div>
            <MarkdownEditor
              value={content}
              onChange={setContent}
              onSave={handleSave}
              saving={saving}
            />
            <Checkbox isSelected={sendPush} onChange={setSendPush}>
              <Checkbox.Content>
                <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
                {t('info.send_push')}
              </Checkbox.Content>
            </Checkbox>
          </div>
        </Tabs.Panel>
        <Tabs.Panel id="personal">
          <div className="mt-2">
            <AdminPersonalInfoPanel />
          </div>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
