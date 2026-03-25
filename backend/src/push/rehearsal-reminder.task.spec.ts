import { Test } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from './push.service';
import { RehearsalReminderTask } from './rehearsal-reminder.task';

describe('RehearsalReminderTask', () => {
  let task: RehearsalReminderTask;
  let prismaMock: DeepMockProxy<PrismaClient>;
  let pushService: jest.Mocked<PushService>;

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaClient>();
    pushService = {
      sendToMember: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<PushService>;

    const module = await Test.createTestingModule({
      providers: [
        RehearsalReminderTask,
        { provide: PrismaService, useValue: prismaMock },
        { provide: PushService, useValue: pushService },
      ],
    }).compile();

    task = module.get(RehearsalReminderTask);
  });

  it('queries only non-optional rehearsals for reminders', async () => {
    const upcoming = new Date(Date.now() + 2 * 86_400_000);
    prismaMock.rehearsal.findFirst.mockResolvedValue({
      id: 'r1',
      date: upcoming,
      title: 'Probe',
      description: null,
      isOptional: false,
      location: null,
      durationMinutes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    prismaMock.member.findMany.mockResolvedValue([]);
    prismaMock.attendancePlan.findMany.mockResolvedValue([]);

    await task.sendDailyReminders();

    expect(prismaMock.rehearsal.findFirst).toHaveBeenCalledWith({
      where: { date: { gte: expect.any(Date) }, isOptional: false },
      orderBy: { date: 'asc' },
    });
  });

  it('does not send reminders when no mandatory rehearsal is found', async () => {
    prismaMock.rehearsal.findFirst.mockResolvedValue(null);

    await task.sendDailyReminders();

    expect(pushService.sendToMember).not.toHaveBeenCalled();
  });
});
