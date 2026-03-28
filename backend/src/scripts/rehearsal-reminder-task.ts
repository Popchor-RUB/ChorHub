import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { RehearsalReminderTask } from '../push/rehearsal-reminder.task';

async function run(): Promise<void> {
  const logger = new Logger('RehearsalReminderRunner');
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    logger.log('Starting rehearsal reminder task run');
    const task = app.get(RehearsalReminderTask);
    await task.sendDailyReminders();
    logger.log('Rehearsal reminder task run completed');
  } finally {
    await app.close();
  }
}

void run().catch((error: unknown) => {
  const logger = new Logger('RehearsalReminderRunner');
  logger.error(`Rehearsal reminder task run failed: ${String(error)}`);
  process.exit(1);
});
