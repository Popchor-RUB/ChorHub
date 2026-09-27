import { countUnexcusedAbsences, getEuropeBerlinStartOfDay } from './unexcused-absence-count';

describe('countUnexcusedAbsences', () => {
  const date = new Date('2026-06-01T18:00:00Z');
  const rehearsal = (id: string, overrides: Partial<{
    date: Date;
    isOptional: boolean;
    hasAttendanceRecord: boolean;
  }> = {}) => ({
    id,
    date,
    isOptional: false,
    hasAttendanceRecord: true,
    ...overrides,
  });

  it('counts only recorded, required, past absences after membership started', () => {
    const count = countUnexcusedAbsences({
      memberCreatedAt: new Date('2026-01-01T00:00:00Z'),
      rehearsals: [
        rehearsal('unexcused'),
        rehearsal('attended'),
        rehearsal('declined'),
        rehearsal('optional', { isOptional: true }),
        rehearsal('unrecorded', { hasAttendanceRecord: false }),
        rehearsal('before-joining', { date: new Date('2025-12-01T18:00:00Z') }),
        rehearsal('today', { date: new Date('2026-06-02T08:00:00Z') }),
      ],
      attendedRehearsalIds: ['attended'],
      declinedRehearsalIds: ['declined'],
      now: new Date('2026-06-01T22:00:00Z'),
    });
    expect(count).toBe(1);
  });

  it('uses Berlin midnight offset before a daylight saving change', () => {
    expect(getEuropeBerlinStartOfDay(new Date('2026-03-29T09:00:00Z')).toISOString())
      .toBe('2026-03-28T23:00:00.000Z');
    expect(getEuropeBerlinStartOfDay(new Date('2026-10-25T09:00:00Z')).toISOString())
      .toBe('2026-10-24T22:00:00.000Z');
  });
});
