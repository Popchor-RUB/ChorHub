import { useEffect, useState } from 'react';
import { Spinner } from '@heroui/react';
import { rehearsalsApi } from '../../services/api';
import { RehearsalCard } from '../../components/rehearsal/RehearsalCard';
import type { Rehearsal } from '../../types';

export function RehearsalsPage() {
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRehearsals = async () => {
    // Fetch all rehearsals (past + upcoming) using ?all=true (member auth)
    const res = await rehearsalsApi.getAllForMember().catch(() => ({ data: [] }));
    setRehearsals(res.data as Rehearsal[]);
    setLoading(false);
  };

  useEffect(() => { loadRehearsals(); }, []);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  // upcoming rehearsals should be sorted ascending
  const upcoming = rehearsals.filter((r) => new Date(r.date) >= startOfToday).reverse();
  // past rehearsals should be sorted descending (already sorted by the backend)
  const past = rehearsals.filter((r) => new Date(r.date) < startOfToday);

  if (loading) {
    return <div className="flex justify-center pt-16"><Spinner size="lg" /></div>;
  }

  const recorded = past.filter((r) => r.myAttended != null);
  const attended = recorded.filter((r) => r.myAttended === true).length;
  const excused = recorded.filter((r) => r.myAttended === false && r.myPlan === 'DECLINED').length;
  const unexcused = recorded.filter((r) => r.myAttended === false && r.myPlan !== 'DECLINED').length;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Proben</h1>

      {recorded.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center justify-center gap-1 bg-success-50 dark:bg-success-50/10 rounded-xl p-3 border border-success-200 dark:border-success-800">
            <span className="text-2xl font-bold text-success">{attended}</span>
            <span className="text-xs text-success-700 dark:text-success-400 text-center">Anwesend</span>
          </div>
          <div className="flex flex-col items-center justify-center gap-1 bg-warning-50 dark:bg-warning-50/10 rounded-xl p-3 border border-warning-200 dark:border-warning-800">
            <span className="text-2xl font-bold text-warning">{excused}</span>
            <span className="text-xs text-warning-700 dark:text-warning-400 text-center">Entschuldigt</span>
          </div>
          <div className="flex flex-col items-center justify-center gap-1 bg-danger-50 dark:bg-danger-50/10 rounded-xl p-3 border border-danger-200 dark:border-danger-800">
            <span className="text-2xl font-bold text-danger">{unexcused}</span>
            <span className="text-xs text-danger-700 dark:text-danger-400 text-center leading-tight">Unentschuldigt</span>
          </div>
        </div>
      )}

      {/* Upcoming rehearsals */}
      <section>
        <h2 className="text-base font-semibold text-default-600 mb-3">
          Bevorstehend ({upcoming.length})
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-default-400 text-sm">Keine bevorstehenden Proben eingetragen.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {upcoming.map((r) => (
              <RehearsalCard key={r.id} rehearsal={r} onUpdated={loadRehearsals} />
            ))}
          </div>
        )}
      </section>

      {/* Past rehearsals */}
      {past.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-default-400 mb-3">
            Vergangen ({past.length})
          </h2>
          <div className="flex flex-col gap-3">
            {past.map((r) => (
              <RehearsalCard
                key={r.id}
                rehearsal={r}
                onUpdated={loadRehearsals}
                readOnly
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
