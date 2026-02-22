import { useEffect, useState } from 'react';
import { Spinner } from '@heroui/react';
import { rehearsalsApi } from '../../services/api';
import { RehearsalCard } from '../../components/rehearsal/RehearsalCard';
import type { Rehearsal } from '../../types';

export function RehearsalsPage() {
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRehearsals = async () => {
    const res = await rehearsalsApi.getUpcoming().catch(() => ({ data: [] }));
    setRehearsals(res.data as Rehearsal[]);
    setLoading(false);
  };

  useEffect(() => { loadRehearsals(); }, []);

  if (loading) {
    return <div className="flex justify-center pt-16"><Spinner size="lg" /></div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Alle Proben</h1>
      {rehearsals.length === 0 ? (
        <p className="text-default-500">Keine bevorstehenden Proben eingetragen.</p>
      ) : (
        rehearsals.map((r) => (
          <RehearsalCard key={r.id} rehearsal={r} onUpdated={loadRehearsals} />
        ))
      )}
    </div>
  );
}
