import { spawn } from 'node:child_process';
import path from 'node:path';
import type { ScheduledTaskName } from '../src/scripts/run-scheduled-task';

export function triggerScheduledTask(name: ScheduledTaskName): Promise<void> {
  // ts-node preserves Nest's constructor metadata, which tsx does not emit.
  const backendDirectory = path.resolve(__dirname, '..');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      '-r', path.join(backendDirectory, 'scripts/register-task-runtime.cjs'),
      path.join(backendDirectory, 'src/scripts/scheduled-task.ts'), name,
    ], { cwd: backendDirectory, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Scheduled task ${name} failed (${signal ?? code})`));
    });
  });
}
