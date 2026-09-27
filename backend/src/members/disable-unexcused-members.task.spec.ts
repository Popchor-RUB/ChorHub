import { mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../prisma/prisma.service';
import { MemberStatusService } from './member-status.service';
import { DisableUnexcusedMembersTask } from './disable-unexcused-members.task';

describe('DisableUnexcusedMembersTask', () => {
  it('disables only active members with at least three qualifying absences', async () => {
    const prisma = mockDeep<PrismaService>();
    const status = mockDeep<MemberStatusService>();
    const task = new DisableUnexcusedMembersTask(prisma, status);
    const date = new Date(Date.now() - 2 * 24 * 60 * 60_000);
    const rehearsals = ['r1', 'r2', 'r3'].map((id) => ({
      id,
      date,
      isOptional: false,
      attendanceRecords: [{ id: `record-${id}` }],
    }));
    prisma.rehearsal.findMany.mockResolvedValue(rehearsals as never);
    prisma.member.findMany.mockResolvedValue([
      {
        id: 'absent',
        createdAt: new Date(Date.now() - 20 * 24 * 60 * 60_000),
        attendanceRecords: [],
        attendancePlans: [],
      },
      {
        id: 'excused',
        createdAt: new Date(Date.now() - 20 * 24 * 60 * 60_000),
        attendanceRecords: [],
        attendancePlans: [{ rehearsalId: 'r3' }],
      },
    ] as never);

    await task.runDailyDisablement();

    expect(prisma.member.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { isDisabled: false },
    }));
    expect(status.disable).toHaveBeenCalledTimes(1);
    expect(status.disable).toHaveBeenCalledWith('absent', undefined, true);
  });
});
