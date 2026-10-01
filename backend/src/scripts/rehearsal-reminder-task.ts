import { Logger } from '@nestjs/common';
import { runScheduledTask } from './run-scheduled-task';

void runScheduledTask('reminder').catch((error: unknown) => {
  const logger = new Logger('RehearsalReminderRunner');
  logger.error(`Rehearsal reminder task run failed: ${String(error)}`);
  process.exitCode = 1;
});
