import { Card, CardBody, CardHeader, Button, Chip } from '@heroui/react';
import type { Rehearsal, AttendanceResponse } from '../../types';
import { attendanceApi } from '../../services/api';
import { useState } from 'react';

interface Props {
  rehearsal: Rehearsal;
  onUpdated: () => void;
}

const formatDate = (dateStr: string) =>
  new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));

export function RehearsalCard({ rehearsal, onUpdated }: Props) {
  const [loading, setLoading] = useState<AttendanceResponse | null>(null);

  const setPlan = async (response: AttendanceResponse) => {
    setLoading(response);
    try {
      await attendanceApi.setPlan(rehearsal.id, response);
      onUpdated();
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col items-start gap-1">
        <h3 className="text-lg font-semibold">{rehearsal.title}</h3>
        <p className="text-sm text-default-500">{formatDate(rehearsal.date)}</p>
      </CardHeader>
      <CardBody className="flex flex-col gap-3">
        {rehearsal.description && (
          <p className="text-sm text-default-600">{rehearsal.description}</p>
        )}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Meine Anmeldung:</span>
          {rehearsal.myPlan === 'CONFIRMED' && <Chip color="success" size="sm">Zugesagt</Chip>}
          {rehearsal.myPlan === 'DECLINED' && <Chip color="danger" size="sm">Abgesagt</Chip>}
          {!rehearsal.myPlan && <Chip color="default" size="sm">Keine Angabe</Chip>}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            color="success"
            variant={rehearsal.myPlan === 'CONFIRMED' ? 'solid' : 'bordered'}
            isLoading={loading === 'CONFIRMED'}
            onPress={() => setPlan('CONFIRMED')}
          >
            Ich komme
          </Button>
          <Button
            size="sm"
            color="danger"
            variant={rehearsal.myPlan === 'DECLINED' ? 'solid' : 'bordered'}
            isLoading={loading === 'DECLINED'}
            onPress={() => setPlan('DECLINED')}
          >
            Ich komme nicht
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
