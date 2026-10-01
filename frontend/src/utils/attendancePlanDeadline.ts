import type { Rehearsal } from '../types';

export function getAttendancePlanDeadline(rehearsal: Pick<Rehearsal, 'date' | 'durationMinutes'>): number {
  return new Date(rehearsal.date).getTime() + (rehearsal.durationMinutes ?? 120) * 60_000;
}
