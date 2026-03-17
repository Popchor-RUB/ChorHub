import { Card, CardBody, CardHeader, Button, Chip } from '@heroui/react';
import type { Rehearsal, AttendanceResponse } from '../../types';
import { attendanceApi } from '../../services/api';
import { useState } from 'react';

interface Props {
  rehearsal: Rehearsal;
  onUpdated: () => void;
  readOnly?: boolean;
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

export function RehearsalCard({ rehearsal, onUpdated, readOnly = false }: Props) {
  const [loading, setLoading] = useState<AttendanceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasStarted = new Date(rehearsal.date) <= new Date();
  const buttonsDisabled = readOnly || hasStarted;



  const setPlan = async (response: AttendanceResponse) => {
    if (buttonsDisabled) return;
    setLoading(response);
    setError(null);
    try {
      if (rehearsal.myPlan === response) {
        await attendanceApi.deletePlan(rehearsal.id);
      } else {
        await attendanceApi.setPlan(rehearsal.id, response);
      }
      onUpdated();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Anmeldung konnte nicht gespeichert werden');
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card className={`w-full ${readOnly ? 'opacity-80' : ''}`} data-testid="rehearsal-card">
      <CardHeader className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-2 w-full">
          <h3 className="text-lg font-semibold flex-1">{rehearsal.title}</h3>
          {readOnly && (
            <Chip size="sm" variant="flat" color="default">
              Vergangen
            </Chip>
          )}
        </div>
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
        {rehearsal.myAttended != null && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Anwesenheit:</span>
            {rehearsal.myAttended === true && (
              <Chip color="success" size="sm" variant="flat">Anwesend</Chip>
            )}
            {rehearsal.myAttended === false && rehearsal.myPlan === 'DECLINED' && (
              <Chip color="warning" size="sm" variant="flat">Entschuldigt</Chip>
            )}
            {rehearsal.myAttended === false && rehearsal.myPlan !== 'DECLINED' && (
              <Chip color="danger" size="sm">Unentschuldigt gefehlt</Chip>
            )}
            {rehearsal.myAttended === null && (
              <Chip color="default" size="sm" variant="flat">Nicht erfasst</Chip>
            )}
          </div>
        )}
        <div className="flex gap-2">
          <Button
            size="sm"
            color="success"
            variant={rehearsal.myPlan === 'CONFIRMED' ? 'solid' : 'bordered'}
            isLoading={loading === 'CONFIRMED'}
            onPress={() => setPlan('CONFIRMED')}
            isDisabled={buttonsDisabled}
          >
            Ich komme
          </Button>
          <Button
            size="sm"
            color="danger"
            variant={rehearsal.myPlan === 'DECLINED' ? 'solid' : 'bordered'}
            isLoading={loading === 'DECLINED'}
            onPress={() => setPlan('DECLINED')}
            isDisabled={buttonsDisabled}
          >
            Ich komme nicht
          </Button>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </CardBody>
    </Card>
  );
}
