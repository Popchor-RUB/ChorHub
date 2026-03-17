import { test, expect } from '@playwright/test';
import { getAdminToken, getFirstMember } from './helpers/api';
import { clearMailHog, getLatestMagicLinkCode } from './helpers/mailhog';

// Runs in the 'no-auth' project — no storageState injected

test.describe('Admin login', () => {
  test('valid credentials redirect to /admin/mitglieder', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.getByText('Administratoren-Anmeldung')).toBeVisible();

    await page.getByLabel('Benutzername').fill('admin');
    await page.getByLabel('Passwort').fill('admin123');
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();

    await page.waitForURL('**/admin/mitglieder');
    await expect(page.getByRole('heading', { name: 'Mitglieder' })).toBeVisible();
  });

  test('invalid credentials show error', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Benutzername').fill('admin');
    await page.getByLabel('Passwort').fill('wrong-password');
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();

    await expect(page.getByText('Ungültige Anmeldedaten.')).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});

test.describe('Member magic link flow', () => {
  let memberEmail: string;

  // Request the email once per describe block to avoid rate limiting
  test.beforeAll(async () => {
    const token = await getAdminToken();
    const member = await getFirstMember(token);
    memberEmail = member.email;
  });

  test('full flow: email → code screen → MailHog code → redirect to /proben', async ({ page }) => {
    await clearMailHog();

    await page.goto('/login');
    await expect(page.getByText('Mitglieder-Anmeldung')).toBeVisible();

    await page.getByLabel('E-Mail-Adresse oder Token').fill(memberEmail);
    await page.getByRole('button', { name: 'Weiter' }).click();

    await expect(page.getByText('6-stelliger Code')).toBeVisible();
    await expect(page.getByText(memberEmail)).toBeVisible();

    const code = await getLatestMagicLinkCode(memberEmail);

    await page.getByLabel('6-stelliger Code').fill(code);
    await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();

    await page.waitForURL('**/proben');
    await expect(page.getByRole('heading', { name: 'Proben' })).toBeVisible();
  });

  test('wrong code shows error message', async ({ page }) => {
    await clearMailHog();

    await page.goto('/login');
    await page.getByLabel('E-Mail-Adresse oder Token').fill(memberEmail);
    await page.getByRole('button', { name: 'Weiter' }).click();
    await expect(page.getByText('6-stelliger Code')).toBeVisible();

    // Drain the real code so it can't be accidentally used
    await getLatestMagicLinkCode(memberEmail).catch(() => null);

    await page.getByLabel('6-stelliger Code').fill('000000');
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();

    await expect(
      page.getByText('Ungültiger oder abgelaufener Code'),
    ).toBeVisible();
  });

  test('back button returns to email screen', async ({ page }) => {
    await clearMailHog();

    await page.goto('/login');
    await page.getByLabel('E-Mail-Adresse oder Token').fill(memberEmail);
    await page.getByRole('button', { name: 'Weiter' }).click();
    await expect(page.getByText('6-stelliger Code')).toBeVisible();

    await page.getByRole('button', { name: 'Zurück' }).click();

    await expect(page.getByLabel('E-Mail-Adresse oder Token')).toBeVisible();
  });
});
