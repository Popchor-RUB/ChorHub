export interface CountableRehearsal {
  id: string;
  date: Date;
  isOptional: boolean;
  hasAttendanceRecord: boolean;
}

export function getEuropeBerlinStartOfDay(date = new Date()): Date {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZoneName: 'shortOffset',
  });
  const parts = formatter.formatToParts(date);
  const values = new Map(parts.map(({ type, value }) => [type, value]));
  const year = Number(values.get('year'));
  const month = Number(values.get('month'));
  const day = Number(values.get('day'));
  // Offset at local midnight can differ from offset later that day during DST changes.
  const utcMidnight = new Date(Date.UTC(year, month - 1, day));
  const midnightParts = formatter.formatToParts(utcMidnight);
  const midnightOffset = midnightParts.find((part) => part.type === 'timeZoneName')?.value;
  const offset = midnightOffset?.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/) ?? null;
  const offsetMinutes = offset
    ? (offset[1] === '-' ? -1 : 1) * (Number(offset[2]) * 60 + Number(offset[3] ?? 0))
    : 0;
  return new Date(Date.UTC(year, month - 1, day) - offsetMinutes * 60_000);
}

export function getUnexcusedAbsenceRehearsalIds(params: {
  memberCreatedAt: Date;
  rehearsals: CountableRehearsal[];
  attendedRehearsalIds: Iterable<string>;
  declinedRehearsalIds: Iterable<string>;
  now?: Date;
}): string[] {
  const now = params.now ?? getEuropeBerlinStartOfDay();
  const attended = new Set(params.attendedRehearsalIds);
  const declined = new Set(params.declinedRehearsalIds);
  return params.rehearsals.filter((rehearsal) =>
    !rehearsal.isOptional &&
    rehearsal.hasAttendanceRecord &&
    rehearsal.date < now &&
    rehearsal.date >= params.memberCreatedAt &&
    !attended.has(rehearsal.id) &&
    !declined.has(rehearsal.id),
  ).map((rehearsal) => rehearsal.id);
}

export function countUnexcusedAbsences(params: Parameters<typeof getUnexcusedAbsenceRehearsalIds>[0]): number {
  return getUnexcusedAbsenceRehearsalIds(params).length;
}
