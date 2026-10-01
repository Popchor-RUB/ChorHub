import { Logger } from '@nestjs/common';
import { isScheduledTaskName, runScheduledTask } from './run-scheduled-task';

async function main(): Promise<void> {
  const [, , name, ...args] = process.argv;
  if (!isScheduledTaskName(name) || args.length > 0) {
    throw new Error('Usage: scheduled-task <reminder|automatic-disable>');
  }
  await runScheduledTask(name);
}

void main().catch((error: unknown) => {
  new Logger('ScheduledTaskRunner').error(`Scheduled task failed: ${String(error)}`);
  process.exitCode = 1;
});
