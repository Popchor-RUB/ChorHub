import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { getFirstMember } from './helpers/api';
import { clearMailHog, getLatestMagicLinkCode } from './helpers/mailhog';

const AUTH_DIR = path.join(__dirname, '.auth');
const ADMIN_STATE_PATH = path.join(AUTH_DIR, 'admin.json');
const MEMBER_STATE_PATH = path.join(AUTH_DIR, 'member.json');
const FRONTEND_URL = 'http://localhost:5173';

export default async function globalSetup() {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  const browser = await chromium.launch();

  // ── Admin auth ────────────────────────────────────────────────────────────
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();

  await adminPage.goto(`${FRONTEND_URL}/admin/login`);
  await adminPage.waitForSelector('text=Administratoren-Anmeldung');

  await adminPage.getByLabel('Benutzername').fill('admin');
  await adminPage.getByLabel('Passwort').fill('admin123');
  await adminPage.getByRole('button', { name: 'Anmelden', exact: true }).click();

  await adminPage.waitForURL('**/admin/mitglieder', { timeout: 10_000 });

  await adminContext.storageState({ path: ADMIN_STATE_PATH });
  await adminContext.close();

  // Extract admin JWT from saved storage state so tests don't need to re-login
  const savedState = JSON.parse(fs.readFileSync(ADMIN_STATE_PATH, 'utf-8'));
  const authEntry = savedState.origins
    ?.flatMap((o: { localStorage: { name: string; value: string }[] }) => o.localStorage)
    ?.find((e: { name: string }) => e.name === 'chorhub-auth');
  if (authEntry) {
    const parsed = JSON.parse(authEntry.value);
    const adminJwt = parsed?.state?.adminSession?.token;
    if (adminJwt) {
      fs.writeFileSync(
        path.join(AUTH_DIR, 'admin-token.json'),
        JSON.stringify({ token: adminJwt }),
      );
    }
  }

  // ── Member auth ───────────────────────────────────────────────────────────
  // Use the cached token (just written above) to avoid a second auth API call
  const adminToken = JSON.parse(fs.readFileSync(path.join(AUTH_DIR, 'admin-token.json'), 'utf-8')).token;
  const member = await getFirstMember(adminToken);
  const memberEmail = member.email;

  await clearMailHog();

  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();

  await memberPage.goto(`${FRONTEND_URL}/login`);
  await memberPage.waitForSelector('text=Mitglieder-Anmeldung');

  await memberPage.getByLabel('E-Mail-Adresse oder Token').fill(memberEmail);
  await memberPage.getByRole('button', { name: 'Weiter' }).click();

  await memberPage.waitForSelector('text=6-stelliger Code', { timeout: 10_000 });

  const code = await getLatestMagicLinkCode(memberEmail, {
    timeoutMs: 15_000,
    pollIntervalMs: 500,
  });

  await memberPage.getByLabel('6-stelliger Code').fill(code);
  await memberPage.getByRole('button', { name: 'Anmelden', exact: true }).click();

  await memberPage.waitForURL('**/proben', { timeout: 10_000 });

  await memberContext.storageState({ path: MEMBER_STATE_PATH });
  await memberContext.close();

  await browser.close();
}
