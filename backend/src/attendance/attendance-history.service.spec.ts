import { mockDeep } from 'jest-mock-extended';
import type { Member } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceService } from './attendance.service';

describe('Attendance history for disabled members', () => {
  const date = new Date('2025-01-01T19:00:00Z');
  const now = new Date('2025-01-10T12:00:00Z');
  const rehearsal = {
    id: 'rehearsal', date, title: 'Rehearsal', description: null, location: null,
    durationMinutes: 120, isOptional: false, createdAt: date, updatedAt: date,
  };
  const active: Member = {
    id: 'active', firstName: 'Anna', lastName: 'Test', email: 'anna@example.test',
    choirVoiceId: 'voice', lastLoginAt: null, isDisabled: false, disabledAt: null,
    disableReason: null, internalComment: null, createdAt: date, updatedAt: date,
  };
  const members = [
    active,
    { ...active, id: 'after', isDisabled: true, disabledAt: new Date(date.getTime() + 1) },
    { ...active, id: 'at', isDisabled: true, disabledAt: date },
    { ...active, id: 'before', isDisabled: true, disabledAt: new Date(date.getTime() - 1) },
    { ...active, id: 'unknown', isDisabled: true },
  ].map((member) => ({
    ...member,
    choirVoice: { id: 'voice', name: member.id === 'after' ? 'Alt' : 'Sopran' },
    attendancePlans: [{ response: 'CONFIRMED' }],
    attendanceRecords: [{ id: `record-${member.id}` }],
  }));
  let prisma: ReturnType<typeof mockDeep<PrismaService>>;
  let service: AttendanceService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    prisma = mockDeep<PrismaService>();
    service = new AttendanceService(prisma);
    prisma.rehearsal.findUnique.mockResolvedValue(rehearsal);
    prisma.rehearsal.findMany.mockResolvedValue([]);
    prisma.member.findMany.mockResolvedValue(members);
  });

  afterEach(() => jest.useRealTimers());

  describe.each(['admin', 'voice-admin'] as const)('%s records', (role) => {
    const read = (attendance: AttendanceService) => role === 'admin'
      ? attendance.getRecordsForRehearsal('rehearsal')
      : attendance.getVoiceAdminRecordsForRehearsal('rehearsal', ['voice']);

    it('retains members disabled after start and excludes earlier, equal, or unknown disable times', async () => {
      const records = await read(service);

      expect(records.map(({ id }) => id)).toEqual(['active', 'after']);
      expect(records.filter(({ attended }) => attended)).toHaveLength(2);
      expect(records.filter(({ plan }) => plan === 'CONFIRMED')).toHaveLength(2);
      if (role === 'voice-admin') {
        expect(prisma.member.findMany).toHaveBeenCalledWith(expect.objectContaining({
          where: { choirVoiceId: { in: ['voice'] } },
          select: expect.objectContaining({ isDisabled: true, disabledAt: true }),
        }));
        expect(records.every((record) => !('email' in record))).toBe(true);
      } else {
        expect(prisma.member.findMany.mock.calls[0]?.[0]?.where).toBeUndefined();
      }
    });

    it('keeps disabled members out of future rehearsals', async () => {
      prisma.rehearsal.findUnique.mockResolvedValue({
        ...rehearsal, date: new Date(now.getTime() + 86_400_000),
      });
      expect((await read(service)).map(({ id }) => id)).toEqual(['active']);
    });
  });

  it('counts plans and attendance by each rehearsal date, including voice totals', async () => {
    const plans = members.map((member) => ({ member }));
    const records = members.filter((member) => member.attendanceRecords.length > 0)
      .map((member) => ({ member }));
    const future = [{
      ...rehearsal, id: 'future', date: new Date(now.getTime() + 86_400_000),
      attendancePlans: plans,
    }];
    const past = [
      { ...rehearsal, attendancePlans: plans, attendanceRecords: records },
      {
        ...rehearsal, id: 'later', date: new Date('2025-01-02T19:00:00Z'),
        attendancePlans: plans, attendanceRecords: records,
      },
    ];
    prisma.rehearsal.findMany.mockResolvedValueOnce(future).mockResolvedValueOnce(past);

    const overview = await service.getRehearsalListOverview();

    expect(overview.future[0]).toMatchObject({ totalConfirmed: 1, byVoice: { Sopran: 1 } });
    expect(overview.past).toEqual([
      expect.objectContaining({ id: 'rehearsal', totalConfirmed: 2, totalAttended: 2, byVoice: { Sopran: 1, Alt: 1 } }),
      expect.objectContaining({ id: 'later', totalConfirmed: 1, totalAttended: 1, byVoice: { Sopran: 1 } }),
    ]);
    expect(prisma.rehearsal.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      include: expect.objectContaining({
        attendancePlans: {
          where: { response: 'CONFIRMED' },
          select: { member: { select: { isDisabled: true, disabledAt: true } } },
        },
        attendanceRecords: {
          include: { member: { select: { isDisabled: true, disabledAt: true, choirVoice: { select: { name: true } } } } },
        },
      }),
    }));
  });
});
