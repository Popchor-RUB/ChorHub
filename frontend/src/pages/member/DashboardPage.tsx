import { useEffect, useState } from 'react';
import { Spinner, Tabs, Tab } from '@heroui/react';
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
    <div className="bg-background rounded-xl p-4 border border-divider">
      <Tabs
        aria-label={t('info.member_segment_aria')}
        variant="bordered"
        classNames={{ panel: 'pt-4' }}
      >
        <Tab key="general" title={t('info.member_general_tab')}>
          <MarkdownRenderer content={generalInfo?.markdownContent ?? ''} />
        </Tab>
        <Tab key="personal" title={t('info.member_personal_tab')}>
          <MarkdownRenderer
            content={personalInfo?.markdownContent ?? ''}
            emptyMessage={t('info.personal_empty')}
          />
        </Tab>
      </Tabs>
    </div>
  );
}
