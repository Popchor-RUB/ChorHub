import { useEffect, useState } from 'react';
import { Spinner } from '@heroui/react';
import { generalInfoApi, rehearsalsApi } from '../../services/api';
import { MarkdownRenderer } from '../../components/info/MarkdownRenderer';
import { RehearsalCard } from '../../components/rehearsal/RehearsalCard';
import type { GeneralInfo, Rehearsal } from '../../types';

export function DashboardPage() {
  const [info, setInfo] = useState<GeneralInfo | null>(null);
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    const [infoRes, rehearsalsRes] = await Promise.all([
      generalInfoApi.get().catch(() => null),
      rehearsalsApi.getUpcoming().catch(() => ({ data: [] })),
    ]);
    if (infoRes) setInfo(infoRes.data);
    setRehearsals((rehearsalsRes.data as Rehearsal[]).slice(0, 3));
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  if (loading) {
    return <div className="flex justify-center pt-16"><Spinner size="lg" /></div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="text-xl font-bold mb-3">Informationen</h2>
        <div className="bg-background rounded-xl p-4 border border-divider">
          <MarkdownRenderer content={info?.markdownContent ?? ''} />
        </div>
      </section>

      {rehearsals.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-3">Nächste Proben</h2>
          <div className="flex flex-col gap-3">
            {rehearsals.map((r) => (
              <RehearsalCard key={r.id} rehearsal={r} onUpdated={loadData} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
