import { useEffect, useState } from 'react';
import { Spinner } from '@heroui/react';
import { generalInfoApi } from '../../services/api';
import { MarkdownRenderer } from '../../components/info/MarkdownRenderer';
import type { GeneralInfo } from '../../types';

export function InformationenPage() {
  const [info, setInfo] = useState<GeneralInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generalInfoApi.get()
      .then((res) => setInfo(res.data))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center pt-16"><Spinner size="lg" /></div>;
  }

  return (
    <div className="bg-background rounded-xl p-4 border border-divider">
      <MarkdownRenderer content={info?.markdownContent ?? ''} />
    </div>
  );
}
