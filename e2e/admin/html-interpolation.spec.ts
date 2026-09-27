import { test, expect } from '@playwright/test';

const htmlPayload = '<img src=x onerror=alert(1)>';

test('rehearsal delete confirmation escapes title markup', async ({ page }) => {
  await page.route('**/attendance/overview/rehearsal-list', (route) =>
    route.fulfill({
      json: {
        future: [{
          id: 'rehearsal-xss-test',
          date: '2099-01-01T18:00:00.000Z',
          title: htmlPayload,
          durationMinutes: 90,
          byVoice: {},
        }],
        past: [],
      },
    }),
  );
  await page.route('**/rehearsals/all', (route) =>
    route.fulfill({
      json: [{
        id: 'rehearsal-xss-test',
        date: '2099-01-01T18:00:00.000Z',
        title: htmlPayload,
        description: null,
        location: null,
        durationMinutes: 90,
        isOptional: false,
      }],
    }),
  );

  await page.goto('/admin/proben');
  await page.getByRole('button', { name: 'Probe löschen', exact: true }).click();

  const dialog = page.getByRole('dialog').filter({ hasText: 'Soll die Probe' });
  await expect(dialog.locator('strong')).toHaveText(htmlPayload);
  await expect(dialog.locator('img')).toHaveCount(0);
});

test('voice delete confirmation escapes name markup', async ({ page }) => {
  await page.route('**/choir-voices', (route) =>
    route.fulfill({
      json: [{ id: 'voice-xss-test', name: htmlPayload, sortOrder: 0, memberCount: 0 }],
    }),
  );

  await page.goto('/admin/einstellungen');
  await page.getByRole('button', { name: 'Löschen' }).first().click();

  const dialog = page.getByRole('dialog').filter({ hasText: 'Soll die Stimmgruppe' });
  await expect(dialog.locator('strong')).toHaveText(htmlPayload);
  await expect(dialog.locator('img')).toHaveCount(0);
});
