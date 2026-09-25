import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [parentPidValue, repoRoot, composeFile, projectName, artifactDir] = process.argv.slice(2);
const parentPid = Number(parentPidValue);
const cleanupMarkerPath = path.join(artifactDir, '.cleanup-complete');
const metadataPath = path.join(artifactDir, 'run.json');

if (!Number.isInteger(parentPid) || !repoRoot || !composeFile || !projectName || !artifactDir) {
  process.exit(2);
}

while (isProcessRunning(parentPid) && !existsSync(cleanupMarkerPath)) {
  await new Promise((resolve) => setTimeout(resolve, 500));
}

if (existsSync(cleanupMarkerPath)) process.exit(0);

const result = spawnSync('docker', [
  'compose',
  '--project-name',
  projectName,
  '--file',
  composeFile,
  'down',
  '--volumes',
  '--remove-orphans',
  '--rmi',
  'local',
], {
  cwd: repoRoot,
  env: process.env,
  stdio: 'ignore',
});

if (result.status === 0) {
  writeFileSync(cleanupMarkerPath, `${new Date().toISOString()}\n`);
}

const existingMetadata = readMetadata();
writeFileSync(metadataPath, `${JSON.stringify({
  ...existingMetadata,
  status: 'failed',
  exitCode: existingMetadata.exitCode ?? 1,
  cleanupRecoveredByWatchdog: true,
  updatedAt: new Date().toISOString(),
}, null, 2)}\n`);

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readMetadata() {
  try {
    return JSON.parse(readFileSync(metadataPath, 'utf8'));
  } catch {
    return {};
  }
}
