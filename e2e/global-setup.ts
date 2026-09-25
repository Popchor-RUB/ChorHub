import { chromium } from '@playwright/test';
import * as fs from 'fs';
import { getFirstMember } from './helpers/api';
import { clearMailHog, getLatestMagicLinkCode } from './helpers/mailhog';
import { authStatePaths, backendUrl, e2eConfig } from './config';

export default async function globalSetup() {
  fs.mkdirSync(e2eConfig.authDir, { recursive: true });

  const browser = await chromium.launch();

  // ── Admin auth ────────────────────────────────────────────────────────────
  const adminContext = await browser.newContext({
    locale: 'de-DE',
    ignoreHTTPSErrors: true,
  });
  const adminPage = await adminContext.newPage();

  await adminPage.goto(`${e2eConfig.baseUrl}/admin/login`);
  await adminPage.waitForSelector('text=Administratoren-Anmeldung');

  await adminPage.getByLabel('Benutzername').fill('admin');
  await adminPage.getByLabel('Passwort').fill('admin123');
  await adminPage.getByRole('button', { name: 'Anmelden', exact: true }).click();

  await adminPage.waitForURL('**/admin/mitglieder', { timeout: 10_000 });

  await adminContext.storageState({ path: authStatePaths.admin });
  await adminContext.close();

  // Extract admin JWT from saved storage state so tests don't need to re-login
  const savedState = JSON.parse(fs.readFileSync(authStatePaths.admin, 'utf-8'));
  const authEntry = savedState.origins
    ?.flatMap((o: { localStorage: { name: string; value: string }[] }) => o.localStorage)
    ?.find((e: { name: string }) => e.name === 'chorhub-auth');
  if (authEntry) {
    const parsed = JSON.parse(authEntry.value);
    const adminJwt = parsed?.state?.adminSession?.token;
    if (adminJwt) {
      fs.writeFileSync(
        authStatePaths.adminToken,
        JSON.stringify({ token: adminJwt }),
      );
    }
  }

  // ── Member auth ───────────────────────────────────────────────────────────
  // Use the cached token (just written above) to avoid a second auth API call
  const adminToken = JSON.parse(fs.readFileSync(authStatePaths.adminToken, 'utf-8')).token;
  const member = await getFirstMember(adminToken);
  const memberEmail = member.email;

  // Guard against occasional seed/list mismatches by ensuring chosen email can request a code.
  const probe = await fetch(backendUrl('/auth/magic-link/request'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: memberEmail }),
  });
  if (!probe.ok) {
    throw new Error(`Global setup member cannot request magic link (${memberEmail}): ${probe.status}`);
  }

  await clearMailHog();

  const memberContext = await browser.newContext({
    locale: 'de-DE',
    ignoreHTTPSErrors: true,
  });
  const memberPage = await memberContext.newPage();

  await memberPage.goto(`${e2eConfig.baseUrl}/login`);
  await memberPage.waitForSelector('text=Mitglieder-Anmeldung');

  await memberPage.getByLabel('E-Mail-Adresse').fill(memberEmail);
  await memberPage.getByRole('button', { name: 'Weiter' }).click();

  await memberPage.getByLabel('6-stelliger Code').waitFor({ timeout: 15_000 });

  const code = await getLatestMagicLinkCode(memberEmail, {
    timeoutMs: 15_000,
    pollIntervalMs: 500,
  });

  await memberPage.getByLabel('6-stelliger Code').fill(code);
  await memberPage.getByRole('button', { name: 'Anmelden', exact: true }).click();

  await memberPage.waitForURL('**/proben', { timeout: 10_000 });

  await memberContext.storageState({ path: authStatePaths.member });
  await memberContext.close();

  await browser.close();
}
