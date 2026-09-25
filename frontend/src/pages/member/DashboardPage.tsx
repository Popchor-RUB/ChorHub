import { useEffect, useState } from 'react';
import { Spinner, Tabs } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { generalInfoApi, personalInfoApi } from '../../services/api';
import { MarkdownRenderer } from '../../components/info/MarkdownRenderer';
import type { GeneralInfo, PersonalInfo } from '../../types';

export function InformationenPage() {
  const [generalInfo, setGeneralInfo] = useState<GeneralInfo | null>(null);
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    Promise.all([
      generalInfoApi.get().then((res) => setGeneralInfo(res.data)),
      personalInfoApi.getMe().then((res) => setPersonalInfo(res.data)),
    ])
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center pt-16"><Spinner size="lg" /></div>;
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-surface">
      <Tabs variant="secondary">
        <Tabs.ListContainer>
          <Tabs.List aria-label={t('info.member_segment_aria')}>
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
        <Tabs.Panel id="general" className="pt-4">
          <MarkdownRenderer content={generalInfo?.markdownContent ?? ''} />
        </Tabs.Panel>
        <Tabs.Panel id="personal" className="pt-4">
          <MarkdownRenderer
            content={personalInfo?.markdownContent ?? ''}
            emptyMessage={t('info.personal_empty')}
          />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
