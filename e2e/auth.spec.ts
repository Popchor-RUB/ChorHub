import { test, expect } from '@playwright/test';
import { createMember, getAdminToken, getFirstMember, setMemberDisabled } from './helpers/api';
import { clearMailHog, getLatestMailBody, getLatestMagicLinkCode } from './helpers/mailhog';

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

    await page.getByLabel('E-Mail-Adresse').fill(memberEmail);
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
    await page.getByLabel('E-Mail-Adresse').fill(memberEmail);
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
    await page.getByLabel('E-Mail-Adresse').fill(memberEmail);
    await page.getByRole('button', { name: 'Weiter' }).click();
    await expect(page.getByText('6-stelliger Code')).toBeVisible();

    await page.getByRole('button', { name: 'Zurück' }).click();

    await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible();
  });

  test('email sent message escapes typed markup', async ({ page }) => {
    const email = 'test<img src=x onerror=alert(1)>@example.test';
    await page.route('**/auth/magic-link/request', (route) => route.fulfill({ json: {} }));

    await page.goto('/login');
    await page.getByLabel('E-Mail-Adresse').fill(email);
    await page.getByRole('button', { name: 'Weiter' }).click();

    const message = page.locator('p').filter({ hasText: 'Eine E-Mail wurde an' });
    await expect(message.locator('strong')).toHaveText(email);
    await expect(message.locator('img')).toHaveCount(0);
  });

  test('resend button is initially disabled on code screen', async ({ page }) => {
    await clearMailHog();

    await page.goto('/login');
    await page.getByLabel('E-Mail-Adresse').fill(memberEmail);
    await page.getByRole('button', { name: 'Weiter' }).click();
    await expect(page.getByText('6-stelliger Code')).toBeVisible();

    await expect(page.getByRole('button', { name: /Erneut senden/ })).toBeDisabled();
  });

  test('unknown email shows invalid credentials on request', async ({ page }) => {
    await clearMailHog();

    await page.goto('/login');
    await page.getByLabel('E-Mail-Adresse').fill('does-not-exist@example.com');
    await page.getByRole('button', { name: 'Weiter' }).click();

    await expect(page.getByText('Ungültige Anmeldedaten.')).toBeVisible();
    await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible();
    await expect(page.getByText('6-stelliger Code')).not.toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('disabled account gets contact message and sends member/admin notices', async ({ page }) => {
    const token = await getAdminToken();
    const member = await createMember(token, {
      firstName: 'Disabled',
      lastName: 'E2E',
      email: `disabled.${Date.now()}@test.de`,
    });
    await clearMailHog();

    try {
      await setMemberDisabled(token, member.id, true, 'E2E disabled account reason');

      const memberNotice = await getLatestMailBody(member.email);
      const adminNotice = await getLatestMailBody('admins@chorhub.test');
      expect(memberNotice).toContain('admins@chorhub.test');
      expect(memberNotice).not.toContain('E2E disabled account reason');
      expect(adminNotice).toContain(member.email);
      expect(adminNotice).toContain('E2E disabled account reason');

      await page.goto('/login');
      await page.getByLabel('E-Mail-Adresse').fill(member.email);
      await page.getByRole('button', { name: 'Weiter' }).click();

      await expect(page.locator('a[href="mailto:admins@chorhub.test"]')).toBeVisible();
      await expect(page.getByText(/deaktiviert|disabled/i)).toBeVisible();
      await expect(page.getByText('6-stelliger Code')).not.toBeVisible();
    } finally {
      await setMemberDisabled(token, member.id, false).catch(() => {});
    }
  });
});
