import { useEffect, useState } from 'react';
import { Tabs, Tab, Card, CardBody, Spinner, Chip } from '@heroui/react';
import { attendanceApi } from '../../services/api';
import type { RehearsalOverview } from '../../types';
import { CHOIR_VOICE_LABELS, type ChoirVoice } from '../../types';

const VOICES: ChoirVoice[] = ['SOPRAN', 'MEZZOSOPRAN', 'ALT', 'TENOR', 'BARITON', 'BASS'];

const formatDate = (d: string) =>
  new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(d));

function OverviewCard({ item, type }: { item: RehearsalOverview; type: 'future' | 'past' }) {
  const total = type === 'future' ? item.totalConfirmed ?? 0 : item.totalAttended ?? 0;
  return (
    <Card>
      <CardBody className="gap-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">{item.title}</p>
            <p className="text-sm text-default-500">{formatDate(item.date)}</p>
          </div>
          <Chip color={type === 'future' ? 'primary' : 'success'} variant="flat" size="lg">
            {total} {type === 'future' ? 'zugesagt' : 'anwesend'}
          </Chip>
        </div>
        <div className="flex flex-wrap gap-2 mt-1">
          {VOICES.map((v) =>
            item.byVoice[v] ? (
              <Chip key={v} size="sm" variant="flat">
                {CHOIR_VOICE_LABELS[v]}: {item.byVoice[v]}
              </Chip>
            ) : null,
          )}
        </div>
      </CardBody>
    </Card>
  );
}

export function RehearsalOverviewPage() {
  const [future, setFuture] = useState<RehearsalOverview[]>([]);
  const [past, setPast] = useState<RehearsalOverview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      attendanceApi.getFutureOverview(),
      attendanceApi.getPastOverview(),
    ]).then(([f, p]) => {
      setFuture(f.data as RehearsalOverview[]);
      setPast(p.data as RehearsalOverview[]);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="flex justify-center pt-8"><Spinner /></div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Probenübersicht</h1>
      <Tabs aria-label="Probenübersicht">
        <Tab key="future" title={`Bevorstehend (${future.length})`}>
          <div className="flex flex-col gap-3 mt-4">
            {future.length === 0 ? (
              <p className="text-default-500">Keine bevorstehenden Proben.</p>
            ) : (
              future.map((r) => <OverviewCard key={r.id} item={r} type="future" />)
            )}
          </div>
        </Tab>
        <Tab key="past" title={`Vergangen (${past.length})`}>
          <div className="flex flex-col gap-3 mt-4">
            {past.length === 0 ? (
              <p className="text-default-500">Keine vergangenen Proben vorhanden.</p>
            ) : (
              past.map((r) => <OverviewCard key={r.id} item={r} type="past" />)
            )}
          </div>
        </Tab>
      </Tabs>
    </div>
  );
}
