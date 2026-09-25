import { randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const composeFile = path.join(repoRoot, 'docker-compose.e2e.yml');
const requestedRunId = process.env.E2E_RUN_ID;
const generatedRunId = `${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}-${process.pid}-${randomBytes(3).toString('hex')}`;
const runId = sanitizeRunId(requestedRunId ?? generatedRunId);
const projectName = `chorhub-e2e-${runId}`.slice(0, 63);
const artifactDir = path.join(repoRoot, '.e2e-runs', runId);
const metadataPath = path.join(artifactDir, 'run.json');
const cleanupMarkerPath = path.join(artifactDir, '.cleanup-complete');
const watchdogPath = path.join(repoRoot, 'e2e', 'scripts', 'cleanup-watchdog.mjs');
const composeArgs = ['compose', '--project-name', projectName, '--file', composeFile];
const playwrightArgs = process.argv.slice(2);
const composeEnv = {
  ...process.env,
  COMPOSE_PROJECT_NAME: projectName,
  E2E_RUN_ID: runId,
  E2E_ARTIFACT_DIR: artifactDir,
};
const cleanupArgs = [
  ...composeArgs,
  'down',
  '--volumes',
  '--remove-orphans',
  '--rmi',
  'local',
];

let activeChild;
let requestedExitCode;
let handlingSignal = false;

function sanitizeRunId(value) {
  const sanitized = value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!sanitized) throw new Error('E2E_RUN_ID must contain at least one letter or number');
  return sanitized.slice(0, 48);
}

function signalExitCode(signal) {
  return signal === 'SIGINT' ? 130 : 143;
}

function runDocker(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, {
      cwd: repoRoot,
      env,
      stdio: 'inherit',
    });
    activeChild = child;

    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (activeChild === child) activeChild = undefined;
      resolve(code ?? (signal ? signalExitCode(signal) : 1));
    });
  });
}

function writeMetadata(status, exitCode) {
  writeFileSync(metadataPath, `${JSON.stringify({
    runId,
    projectName,
    status,
    exitCode,
    artifactDir,
    updatedAt: new Date().toISOString(),
  }, null, 2)}\n`);
}

function markCleanupComplete() {
  writeFileSync(cleanupMarkerPath, `${new Date().toISOString()}\n`);
}

function startCleanupWatchdog() {
  const watchdog = spawn(process.execPath, [
    watchdogPath,
    String(process.pid),
    repoRoot,
    composeFile,
    projectName,
    artifactDir,
  ], {
    cwd: repoRoot,
    detached: true,
    env: composeEnv,
    stdio: 'ignore',
  });
  watchdog.unref();
}

for (const [signal, exitCode] of [['SIGINT', 130], ['SIGTERM', 143]]) {
  process.on(signal, () => {
    if (handlingSignal) process.exit(exitCode);
    handlingSignal = true;
    requestedExitCode = exitCode;
    activeChild?.kill('SIGTERM');
    writeMetadata('failed', exitCode);
    console.log(`E2E run ${runId}: interrupted; removing isolated stack`);
    const cleanupResult = spawnSync('docker', cleanupArgs, {
      cwd: repoRoot,
      env: composeEnv,
      stdio: 'inherit',
    });
    if (cleanupResult.status === 0) markCleanupComplete();
    process.exit(exitCode);
  });
}

async function main() {
  mkdirSync(artifactDir, { recursive: true });
  rmSync(cleanupMarkerPath, { force: true });
  writeMetadata('starting');
  startCleanupWatchdog();

  let exitCode = 1;
  try {
    console.log(`E2E run ${runId}: starting isolated stack`);
    const setupExitCode = await runDocker([
      ...composeArgs,
      'up',
      '--build',
      '--wait',
      'db',
      'mailhog',
      'backend',
      'frontend',
    ], composeEnv);

    if (setupExitCode !== 0 || requestedExitCode) {
      exitCode = requestedExitCode ?? setupExitCode;
    } else {
      writeMetadata('running');
      exitCode = await runDocker([
        ...composeArgs,
        'run',
        '--rm',
        'e2e',
        ...playwrightArgs,
      ], composeEnv);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    exitCode = 1;
  } finally {
    console.log(`E2E run ${runId}: removing isolated stack`);
    try {
      const cleanupExitCode = await runDocker(cleanupArgs, composeEnv);
      if (cleanupExitCode === 0) markCleanupComplete();
      if (cleanupExitCode !== 0 && exitCode === 0) exitCode = cleanupExitCode;
    } catch (error) {
      console.error(`E2E cleanup failed: ${error instanceof Error ? error.message : error}`);
      exitCode ||= 1;
    }
  }

  const finalExitCode = requestedExitCode ?? exitCode;
  writeMetadata(finalExitCode === 0 ? 'passed' : 'failed', finalExitCode);
  console.log(`E2E run ${runId}: artifacts ${artifactDir}`);
  return finalExitCode;
}

process.exitCode = await main();
