import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MailQueueService } from '../mail/mail-queue.service';
import { DisableUnexcusedMembersTask } from '../members/disable-unexcused-members.task';
import { MemberStatusService } from '../members/member-status.service';
import { RehearsalReminderTask } from '../push/rehearsal-reminder.task';
import { ScheduledTaskModule } from './scheduled-task.module';

export type ScheduledTaskName = 'reminder' | 'automatic-disable';

export function isScheduledTaskName(value: string | undefined): value is ScheduledTaskName {
  return value === 'reminder' || value === 'automatic-disable';
}

export async function runScheduledTask(name: ScheduledTaskName): Promise<void> {
  const logger = new Logger('ScheduledTaskRunner');
  const app = await NestFactory.createApplicationContext(ScheduledTaskModule);
  const queue = app.get(MailQueueService);
  const queueName = RehearsalReminderTask.FALLBACK_MAIL_QUEUE;

  try {
    logger.log(`Starting scheduled task: ${name}`);
    if (name === 'reminder') {
      await app.get(RehearsalReminderTask).sendDailyReminders();
    } else {
      await app.get(DisableUnexcusedMembersTask).runDailyDisablement();
    }
  } finally {
    try {
      if (queue.isRunning(queueName)) {
        logger.log('Waiting for queued reminder mail to finish');
        await new Promise<void>((resolve) => queue.setOnDrained(queueName, resolve));
      }
    } finally {
      queue.setOnDrained(queueName, undefined);
      try {
        // Finish notice delivery before Prisma's module shutdown disconnects it.
        await app.get(MemberStatusService).onModuleDestroy();
      } finally {
        await app.close();
      }
    }
  }
  logger.log(`Scheduled task completed: ${name}`);
}
