import * as path from 'path';

const DEFAULT_AUTH_DIR = path.join(__dirname, '.auth');
const DEFAULT_ARTIFACT_DIR = path.join(__dirname, '..');

export const e2eConfig = {
  runId: process.env.E2E_RUN_ID ?? 'local',
  baseUrl: process.env.E2E_BASE_URL ?? 'https://localhost:5173',
  backendUrl: process.env.E2E_BACKEND_URL ?? 'http://localhost:3000',
  mailhogUrl: process.env.E2E_MAILHOG_URL ?? 'http://localhost:8025',
  authDir: path.resolve(process.env.E2E_AUTH_DIR ?? DEFAULT_AUTH_DIR),
  artifactDir: path.resolve(process.env.E2E_ARTIFACT_DIR ?? DEFAULT_ARTIFACT_DIR),
} as const;

export const authStatePaths = {
  admin: path.join(e2eConfig.authDir, 'admin.json'),
  adminToken: path.join(e2eConfig.authDir, 'admin-token.json'),
  member: path.join(e2eConfig.authDir, 'member.json'),
} as const;

export function backendUrl(pathname: string): string {
  return new URL(pathname, `${e2eConfig.backendUrl}/`).toString();
}

export function mailhogUrl(pathname: string): string {
  return new URL(pathname, `${e2eConfig.mailhogUrl}/`).toString();
}
