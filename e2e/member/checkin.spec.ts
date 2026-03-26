import { test, expect } from '@playwright/test';

// Runs in the 'member-auth' project — storageState: e2e/.auth/member.json

test.describe('Member QR check-in page', () => {
  test('loads and shows the member QR code', async ({ page }) => {
    await page.goto('/qr-checkin');
    await expect(page.getByRole('heading', { name: 'QR-Code Checkin' })).toBeVisible();

    const qrImage = page.getByAltText('Check-in QR-Code');
    await expect(qrImage).toBeVisible();
    await expect(qrImage).toHaveAttribute('src', /^data:image\/svg\+xml;base64,/);
  });

  test('refresh button requests a new QR code', async ({ page }) => {
    await page.goto('/qr-checkin');
    await expect(page.getByRole('heading', { name: 'QR-Code Checkin' })).toBeVisible();

    const refreshButton = page.getByRole('button', { name: 'QR-Code aktualisieren' });
    await Promise.all([
      page.waitForResponse((res) =>
        res.url().includes('/members/me/checkin-qr') && res.status() === 200,
      ),
      refreshButton.click(),
    ]);

    const qrImage = page.getByAltText('Check-in QR-Code');
    await expect(qrImage).toBeVisible();
    await expect(qrImage).toHaveAttribute('src', /^data:image\/svg\+xml;base64,/);
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
  });
});
