import { NestFactory } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { MailQueueService } from '../mail/mail-queue.service';
import { DisableUnexcusedMembersTask } from '../members/disable-unexcused-members.task';
import { MemberStatusService } from '../members/member-status.service';
import { RehearsalReminderTask } from '../push/rehearsal-reminder.task';
import { isScheduledTaskName, runScheduledTask } from './run-scheduled-task';

describe('manual scheduled task runner', () => {
  let app: TestingModule;
  const reminder = { sendDailyReminders: jest.fn() };
  const disable = { runDailyDisablement: jest.fn() };
  const status = { onModuleDestroy: jest.fn() };
  const queue = { isRunning: jest.fn(), setOnDrained: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    app = await Test.createTestingModule({
      providers: [
        { provide: RehearsalReminderTask, useValue: reminder },
        { provide: DisableUnexcusedMembersTask, useValue: disable },
        { provide: MemberStatusService, useValue: status },
        { provide: MailQueueService, useValue: queue },
      ],
    }).compile();
    jest.spyOn(NestFactory, 'createApplicationContext').mockResolvedValue(app);
    jest.spyOn(app, 'close');
  });

  afterEach(() => jest.restoreAllMocks());

  it('accepts only the two supported task names', () => {
    expect(isScheduledTaskName('reminder')).toBe(true);
    expect(isScheduledTaskName('automatic-disable')).toBe(true);
    expect(isScheduledTaskName('all')).toBe(false);
    expect(isScheduledTaskName(undefined)).toBe(false);
  });

  it('runs reminders and waits for the mail queue before closing', async () => {
    let drained: (() => void) | undefined;
    queue.isRunning.mockReturnValue(true);
    queue.setOnDrained.mockImplementation((_name: string, callback?: () => void) => {
      drained = callback;
    });
    const run = runScheduledTask('reminder');
    // Allow application creation and reminder dispatch to resolve.
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(reminder.sendDailyReminders).toHaveBeenCalledTimes(1);
    expect(disable.runDailyDisablement).not.toHaveBeenCalled();
    expect(app.close).not.toHaveBeenCalled();
    expect(drained).toBeDefined();
    drained?.();
    await run;
    expect(queue.setOnDrained).toHaveBeenLastCalledWith(RehearsalReminderTask.FALLBACK_MAIL_QUEUE, undefined);
    expect(app.close).toHaveBeenCalledTimes(1);
  });

  it('runs automatic disablement and waits for notices before closing', async () => {
    let finishNotices: (() => void) | undefined;
    status.onModuleDestroy.mockReturnValueOnce(new Promise<void>((resolve) => {
      finishNotices = resolve;
    }));
    const run = runScheduledTask('automatic-disable');
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(disable.runDailyDisablement).toHaveBeenCalledTimes(1);
    expect(reminder.sendDailyReminders).not.toHaveBeenCalled();
    expect(app.close).not.toHaveBeenCalled();
    finishNotices?.();
    await run;
    expect(app.close).toHaveBeenCalledTimes(1);
  });

  it('closes the application and propagates task failures', async () => {
    const failure = new Error('database unavailable');
    disable.runDailyDisablement.mockRejectedValue(failure);
    await expect(runScheduledTask('automatic-disable')).rejects.toThrow(failure);
    expect(app.close).toHaveBeenCalledTimes(1);
  });
});
