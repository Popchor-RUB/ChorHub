import { test, expect } from '@playwright/test';

// Runs in the 'admin-auth' project — storageState: e2e/.auth/admin.json

test.describe('Admin rehearsal overview page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/proben');
    await expect(
      page.getByRole('heading', { name: 'Probenübersicht' }),
    ).toBeVisible();
  });

  test('create rehearsal modal includes location and duration fields', async ({ page }) => {
    await page.getByRole('button', { name: '+ Neue Probe' }).click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(
      modal.getByRole('group', { name: /Datum und Uhrzeit/ }),
    ).toBeVisible();
    await expect(modal.getByLabel('Titel')).toBeVisible();
    await expect(modal.getByLabel('Ort')).toBeVisible();
    await expect(modal.getByLabel('Dauer (Minuten)')).toBeVisible();
  });
});
