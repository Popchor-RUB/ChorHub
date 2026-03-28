import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { AuthService } from '../auth/auth.service';
import { PrismaClient } from '../generated/prisma/client';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from './push.service';
import { RehearsalReminderTask } from './rehearsal-reminder.task';

describe('RehearsalReminderTask', () => {
  let task: RehearsalReminderTask;
  let prismaMock: DeepMockProxy<PrismaClient>;
  let pushService: jest.Mocked<PushService>;
  let authService: jest.Mocked<AuthService>;
  let mailService: jest.Mocked<MailService>;
  let isStaging = false;

  const baseMember = {
    id: 'm-1',
    firstName: 'Anna',
    lastName: 'Müller',
    email: 'anna@choir.de',
    choirVoiceId: null as string | null,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    pushSubscriptions: [] as { id: string }[],
  };

  beforeEach(async () => {
    isStaging = false;
    prismaMock = mockDeep<PrismaClient>();
    pushService = {
      sendToMember: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<PushService>;
    authService = {
      issueMemberMagicLink: jest.fn().mockResolvedValue({
        rawToken: 'raw-token',
        loginCode: '123456',
        magicUrl: 'http://localhost:5173/auth/verify?token=raw-token',
      }),
    } as unknown as jest.Mocked<AuthService>;
    mailService = {
      sendPushFallbackReminderMail: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<MailService>;

    const module = await Test.createTestingModule({
      providers: [
        RehearsalReminderTask,
        { provide: PrismaService, useValue: prismaMock },
        { provide: PushService, useValue: pushService },
        { provide: AuthService, useValue: authService },
        { provide: MailService, useValue: mailService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'IS_STAGING') {
                return isStaging ? 'true' : 'false';
              }
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    task = module.get(RehearsalReminderTask);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('queries only mandatory rehearsals in the upcoming 3-day window', async () => {
    prismaMock.rehearsal.findMany.mockResolvedValue([]);

    await task.sendDailyReminders();

    expect(prismaMock.rehearsal.findMany).toHaveBeenCalledWith({
      where: { date: { gte: expect.any(Date), lt: expect.any(Date) }, isOptional: false },
      orderBy: { date: 'asc' },
    });
  });

  it('sends one combined missing-plan push notification for multiple rehearsals', async () => {
    const now = Date.now();
    prismaMock.rehearsal.findMany.mockResolvedValue([
      { id: 'r1', date: new Date(now + 86_400_000), title: 'Probe A' },
      { id: 'r2', date: new Date(now + 2 * 86_400_000), title: 'Probe B' },
    ] as any);
    prismaMock.member.findMany.mockResolvedValue([
      { ...baseMember, pushSubscriptions: [{ id: 'sub-1' }] },
    ] as any);
    prismaMock.attendancePlan.findMany.mockResolvedValue([]);

    await task.sendDailyReminders();

    expect(pushService.sendToMember).toHaveBeenCalledTimes(1);
    expect(pushService.sendToMember).toHaveBeenCalledWith(
      'm-1',
      expect.objectContaining({
        title: 'ChorHub – Anwesenheit eintragen',
        body: expect.stringContaining('Probe A'),
      }),
    );
    expect(pushService.sendToMember).toHaveBeenCalledWith(
      'm-1',
      expect.objectContaining({
        body: expect.stringContaining('Probe B'),
      }),
    );
  });

  it('sends stale-plan reminder when lastLoginAt is older than 14 days', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-29T09:00:00Z'));
    const now = Date.now();
    prismaMock.rehearsal.findMany.mockResolvedValue([
      { id: 'r1', date: new Date(now + 86_400_000), title: 'Probe A' },
    ] as any);
    prismaMock.member.findMany.mockResolvedValue([
      {
        ...baseMember,
        lastLoginAt: new Date(now - 15 * 86_400_000),
        pushSubscriptions: [{ id: 'sub-1' }],
      },
    ] as any);
    prismaMock.attendancePlan.findMany.mockResolvedValue([
      {
        memberId: 'm-1',
        rehearsalId: 'r1',
        response: 'CONFIRMED',
        rehearsal: { date: new Date(now + 86_400_000), title: 'Probe A' },
      },
    ] as any);

    await task.sendDailyReminders();

    expect(pushService.sendToMember).toHaveBeenCalledWith(
      'm-1',
      expect.objectContaining({
        title: 'ChorHub – Anwesenheitsplan prüfen',
        body: expect.stringContaining('Ist das noch korrekt?'),
      }),
    );
  });

  it('treats null lastLoginAt as stale for stale-plan reminders', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-29T09:00:00Z'));
    const now = Date.now();
    prismaMock.rehearsal.findMany.mockResolvedValue([
      { id: 'r1', date: new Date(now + 86_400_000), title: 'Probe A' },
    ] as any);
    prismaMock.member.findMany.mockResolvedValue([
      { ...baseMember, lastLoginAt: null, pushSubscriptions: [{ id: 'sub-1' }] },
    ] as any);
    prismaMock.attendancePlan.findMany.mockResolvedValue([
      {
        memberId: 'm-1',
        rehearsalId: 'r1',
        response: 'DECLINED',
        rehearsal: { date: new Date(now + 86_400_000), title: 'Probe A' },
      },
    ] as any);

    await task.sendDailyReminders();

    expect(pushService.sendToMember).toHaveBeenCalledWith(
      'm-1',
      expect.objectContaining({
        title: 'ChorHub – Anwesenheitsplan prüfen',
      }),
    );
  });

  it('uses email fallback with magic link when member has no push subscription', async () => {
    const now = Date.now();
    prismaMock.rehearsal.findMany.mockResolvedValue([
      { id: 'r1', date: new Date(now + 86_400_000), title: 'Probe A' },
    ] as any);
    prismaMock.member.findMany.mockResolvedValue([
      { ...baseMember, pushSubscriptions: [] },
    ] as any);
    prismaMock.attendancePlan.findMany.mockResolvedValue([]);
    prismaMock.member.findUnique.mockResolvedValue({
      ...baseMember,
      pushSubscriptions: undefined,
    } as any);

    await task.sendDailyReminders();
    await Promise.resolve();

    expect(pushService.sendToMember).not.toHaveBeenCalled();
    expect(authService.issueMemberMagicLink).toHaveBeenCalledWith('m-1');
    expect(mailService.sendPushFallbackReminderMail).toHaveBeenCalledWith(
      expect.objectContaining({
        member: expect.objectContaining({ id: 'm-1' }),
        magicUrl: 'http://localhost:5173/auth/verify?token=raw-token',
        showGenericLogin: false,
        items: [
          {
            label: expect.stringContaining('Probe A'),
            confirmUrl:
              'http://localhost:5173/auth/verify?token=raw-token&rehearsalId=r1&response=CONFIRMED',
            declineUrl:
              'http://localhost:5173/auth/verify?token=raw-token&rehearsalId=r1&response=DECLINED',
          },
        ],
      }),
    );
  });

  it('keeps stale-plan fallback emails without rehearsal action links', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-29T09:00:00Z'));
    const now = Date.now();
    prismaMock.rehearsal.findMany.mockResolvedValue([
      { id: 'r1', date: new Date(now + 86_400_000), title: 'Probe A' },
    ] as any);
    prismaMock.member.findMany.mockResolvedValue([
      {
        ...baseMember,
        pushSubscriptions: [],
        lastLoginAt: new Date(now - 15 * 86_400_000),
      },
    ] as any);
    prismaMock.attendancePlan.findMany.mockResolvedValue([
      {
        memberId: 'm-1',
        rehearsalId: 'r1',
        response: 'CONFIRMED',
        rehearsal: { date: new Date(now + 86_400_000), title: 'Probe A' },
      },
    ] as any);
    prismaMock.member.findUnique.mockResolvedValue({
      ...baseMember,
      pushSubscriptions: undefined,
    } as any);

    await task.sendDailyReminders();
    await Promise.resolve();

    expect(mailService.sendPushFallbackReminderMail).toHaveBeenCalledWith(
      expect.objectContaining({
        showGenericLogin: true,
        items: [
          {
            label: expect.stringContaining('Probe A'),
          },
        ],
      }),
    );
  });

  it('does not send stale-plan reminder outside the 3-day cadence', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-28T09:00:00Z'));
    const now = Date.now();
    prismaMock.rehearsal.findMany.mockResolvedValue([
      { id: 'r1', date: new Date(now + 86_400_000), title: 'Probe A' },
    ] as any);
    prismaMock.member.findMany.mockResolvedValue([
      {
        ...baseMember,
        lastLoginAt: new Date(now - 15 * 86_400_000),
        pushSubscriptions: [{ id: 'sub-1' }],
      },
    ] as any);
    prismaMock.attendancePlan.findMany.mockResolvedValue([
      {
        memberId: 'm-1',
        rehearsalId: 'r1',
        response: 'CONFIRMED',
        rehearsal: { date: new Date(now + 86_400_000), title: 'Probe A' },
      },
    ] as any);

    await task.sendDailyReminders();

    expect(pushService.sendToMember).not.toHaveBeenCalledWith(
      'm-1',
      expect.objectContaining({
        title: 'ChorHub – Anwesenheitsplan prüfen',
      }),
    );
  });

  it('enforces global fallback email pacing of one email per minute', async () => {
    jest.useFakeTimers();
    const now = Date.now();
    prismaMock.rehearsal.findMany.mockResolvedValue([
      { id: 'r1', date: new Date(now + 86_400_000), title: 'Probe A' },
    ] as any);
    prismaMock.member.findMany.mockResolvedValue([
      { ...baseMember, id: 'm-1', pushSubscriptions: [] },
      { ...baseMember, id: 'm-2', email: 'max@choir.de', pushSubscriptions: [] },
    ] as any);
    prismaMock.attendancePlan.findMany.mockResolvedValue([]);
    prismaMock.member.findUnique
      .mockResolvedValueOnce({
        ...baseMember,
        id: 'm-1',
        email: 'anna@choir.de',
      } as any)
      .mockResolvedValueOnce({
        ...baseMember,
        id: 'm-2',
        email: 'max@choir.de',
      } as any);

    await task.sendDailyReminders();
    await Promise.resolve();

    expect(mailService.sendPushFallbackReminderMail).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(60_000);

    expect(mailService.sendPushFallbackReminderMail).toHaveBeenCalledTimes(2);
  });

  it('disables fallback email pacing in staging mode', async () => {
    isStaging = true;
    const now = Date.now();
    prismaMock.rehearsal.findMany.mockResolvedValue([
      { id: 'r1', date: new Date(now + 86_400_000), title: 'Probe A' },
    ] as any);
    prismaMock.member.findMany.mockResolvedValue([
      { ...baseMember, id: 'm-1', pushSubscriptions: [] },
      { ...baseMember, id: 'm-2', email: 'max@choir.de', pushSubscriptions: [] },
    ] as any);
    prismaMock.attendancePlan.findMany.mockResolvedValue([]);
    prismaMock.member.findUnique
      .mockResolvedValueOnce({
        ...baseMember,
        id: 'm-1',
        email: 'anna@choir.de',
      } as any)
      .mockResolvedValueOnce({
        ...baseMember,
        id: 'm-2',
        email: 'max@choir.de',
      } as any);

    await task.sendDailyReminders();
    for (let i = 0; i < 5 && mailService.sendPushFallbackReminderMail.mock.calls.length < 2; i += 1) {
      await Promise.resolve();
    }

    expect(mailService.sendPushFallbackReminderMail).toHaveBeenCalledTimes(2);
  });
});
