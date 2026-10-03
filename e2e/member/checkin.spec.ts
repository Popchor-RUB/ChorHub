import { test, expect } from '@playwright/test';

// Runs in the 'member-auth' project with the configured member storage state.

test.describe('Member QR check-in page', () => {
  test('loads and shows the member QR code', async ({ page }) => {
    await page.goto('/proben');
    await expect(page.locator('nav a[href="/qr-checkin"]')).toHaveCount(0);
    await page.getByRole('link', { name: 'QR-Code Checkin', exact: true }).click();
    await expect(page).toHaveURL(/\/qr-checkin$/);
    await expect(page.getByRole('heading', { name: 'QR-Code Checkin' })).toBeVisible();

    const qrImage = page.getByAltText('Check-in QR-Code');
    await expect(qrImage).toBeVisible();
    await expect(qrImage).toHaveAttribute('src', /^data:image\/svg\+xml;base64,/);

    await page.getByRole('link', { name: 'Zurück zu den Proben', exact: true }).click();
    await expect(page).toHaveURL(/\/proben$/);
    await expect(page.getByRole('heading', { name: 'Proben', exact: true })).toBeVisible();
  });

  test('shows an error message when QR loading fails', async ({ page }) => {
    await page.route('**/members/me/checkin-qr', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'forced e2e error' }),
      });
    });

    await page.goto('/qr-checkin');
    await expect(page.getByText('QR-Code konnte nicht geladen werden.')).toBeVisible();
    await page.getByRole('link', { name: 'Zurück zu den Proben', exact: true }).click();
    await expect(page).toHaveURL(/\/proben$/);
  });
});
