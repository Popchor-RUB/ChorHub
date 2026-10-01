import { test, expect, devices } from '@playwright/test';
import { createMember, getAdminToken, getFirstMember, setMemberDisabled } from './helpers/api';
import { clearMailHog, getLatestMailBody, getLatestMagicLinkCode } from './helpers/mailhog';

// Runs in the 'no-auth' project — no storageState injected

test.describe('Reminder attendance response on iOS', () => {
  test.use({
    userAgent: devices['iPhone 13'].userAgent,
    viewport: devices['iPhone 13'].viewport,
    isMobile: true,
    hasTouch: true,
  });

  test.beforeEach(async ({ page }) => {
    await page.route('**/auth/magic-link/verify?token=reminder-token', (route) => route.fulfill({
      json: {
        token: 'member-token',
        member: { id: 'reminder-member', firstName: 'Reminder', lastName: 'Test' },
      },
    }));
  });

  for (const [response, message] of [
    ['CONFIRMED', 'Du hast für die Probe zugesagt.'],
    ['DECLINED', 'Du hast für die Probe abgesagt.'],
  ] as const) {
    test(`${response} waits for save then shows confirmation without install guide`, async ({ page }) => {
      const submissions: string[] = [];
      let releaseSave: () => void = () => {};
      const saveAllowed = new Promise<void>((resolve) => { releaseSave = resolve; });
      await page.route('**/attendance/plans/reminder-rehearsal', async (route) => {
        expect(route.request().method()).toBe('PUT');
        expect(route.request().headers()['x-member-token']).toBe('member-token');
        submissions.push(route.request().postDataJSON().response);
        await saveAllowed;
        await route.fulfill({ json: { response } });
      });

      await page.goto(`/auth/verify?token=reminder-token&rehearsalId=reminder-rehearsal&response=${response}`);
      await expect.poll(() => submissions.length).toBe(1);
      await expect(page.getByText('Anmeldung wird verarbeitet...')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Rückmeldung gespeichert', exact: true })).not.toBeVisible();
      releaseSave();

      await expect(page.getByRole('heading', { name: 'Rückmeldung gespeichert', exact: true })).toBeVisible();
      await expect(page.getByText(message, { exact: true })).toBeVisible();
      await expect(page.getByText('Du kannst diese Seite jetzt schließen.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Probenübersicht öffnen' })).toBeVisible();
      await expect(page.getByText('ChorHub installieren', { exact: true })).not.toBeVisible();
      await expect(page).toHaveURL(/\/auth\/verify\?/);
      expect(submissions).toEqual([response]);
    });
  }

  test('failed save shows failure without success confirmation or install guide', async ({ page }) => {
    await page.route('**/attendance/plans/reminder-rehearsal', (route) => route.fulfill({
      status: 404,
      json: { message: 'Rehearsal not found' },
    }));

    await page.goto('/auth/verify?token=reminder-token&rehearsalId=reminder-rehearsal&response=CONFIRMED');

    await expect(page.getByRole('heading', { name: 'Rückmeldung nicht gespeichert' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Bitte öffne die Probenübersicht');
    await expect(page.getByRole('heading', { name: 'Rückmeldung gespeichert', exact: true })).not.toBeVisible();
    await expect(page.getByText('ChorHub installieren', { exact: true })).not.toBeVisible();
    await expect(page).toHaveURL(/\/auth\/verify\?/);
  });

  test('invalid reminder token shows login error without saving attendance', async ({ page }) => {
    let submitted = false;
    await page.route('**/auth/magic-link/verify?token=reminder-token', (route) => route.fulfill({
      status: 403,
      json: { message: 'Invalid token' },
    }));
    await page.route('**/attendance/plans/**', (route) => {
      submitted = true;
      return route.fulfill({ json: {} });
    });

    await page.goto('/auth/verify?token=reminder-token&rehearsalId=reminder-rehearsal&response=CONFIRMED');

    await expect(page.getByText('Anmeldung fehlgeschlagen', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Rückmeldung gespeichert', exact: true })).not.toBeVisible();
    expect(submitted).toBe(false);
  });

  test('regular magic link still opens member area and install guide', async ({ page }) => {
    await page.route('**/members/me', (route) => route.fulfill({ json: { voiceAdminVoices: [] } }));
    await page.route('**/rehearsals?all=true', (route) => route.fulfill({ json: [] }));

    await page.goto('/auth/verify?token=reminder-token');

    await expect(page).toHaveURL(/\/proben$/);
    await expect(page.getByText('ChorHub installieren', { exact: true })).toBeVisible();
  });
});

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
