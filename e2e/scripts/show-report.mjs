import { spawn } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const runsRoot = path.join(repoRoot, '.e2e-runs');
const [firstArgument, ...remainingArguments] = process.argv.slice(2);
const hasRunId = Boolean(firstArgument && !firstArgument.startsWith('-'));
const runId = hasRunId ? firstArgument : findLatestCompletedRun();
const reportArguments = hasRunId ? remainingArguments : process.argv.slice(2);
const reportDir = path.join(runsRoot, validateRunId(runId), 'playwright-report');

if (!existsSync(path.join(reportDir, 'index.html'))) {
  throw new Error(`Playwright report not found: ${reportDir}`);
}

const child = spawn('npx', ['playwright', 'show-report', reportDir, ...reportArguments], {
  cwd: repoRoot,
  stdio: 'inherit',
});

child.once('error', (error) => {
  throw error;
});
child.once('exit', (code) => {
  process.exitCode = code ?? 1;
});

function validateRunId(value) {
  if (!value || !/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new Error(`Invalid E2E run ID: ${value ?? '<missing>'}`);
  }
  return value;
}

function findLatestCompletedRun() {
  if (!existsSync(runsRoot)) throw new Error('No E2E runs found');

  const runs = readdirSync(runsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      reportPath: path.join(runsRoot, entry.name, 'playwright-report', 'index.html'),
    }))
    .filter((entry) => existsSync(entry.reportPath))
    .sort((left, right) => statSync(right.reportPath).mtimeMs - statSync(left.reportPath).mtimeMs);

  if (!runs.length) throw new Error('No completed E2E report found');
  return runs[0].name;
}
