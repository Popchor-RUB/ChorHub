import { test, expect } from '@playwright/test';

// Runs in the 'admin-auth' project — storageState: e2e/.auth/admin.json

test.describe('Admin push notifications page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/benachrichtigungen');
    await expect(
      page.getByRole('heading', { name: 'Push-Benachrichtigungen' }),
    ).toBeVisible();
  });

  test('displays subscriber count widget after loading', async ({ page }) => {
    // Wait for the spinner inside the count widget to disappear
    await expect(page.locator('[data-slot="spinner"]')).not.toBeVisible({
      timeout: 8000,
    });

    // Subscriber count text — singular or plural depending on count
    const countText = page.getByText(/Push-Benachrichtigungen aktiviert/);
    await expect(countText).toBeVisible();
  });

  test('send button is disabled when both fields are empty', async ({ page }) => {
    const sendButton = page.getByRole('button', { name: 'An alle senden' });
    await expect(sendButton).toBeDisabled();
  });

  test('send button stays disabled when only title is filled', async ({ page }) => {
    await page.getByLabel('Titel').fill('Test-Titel');
    await expect(page.getByRole('button', { name: 'An alle senden' })).toBeDisabled();
  });

  test('send button becomes enabled when both title and body are filled', async ({ page }) => {
    await page.getByLabel('Titel').fill('Test-Titel');
    await page.getByLabel('Nachricht').fill('Test-Nachricht');
    await expect(page.getByRole('button', { name: 'An alle senden' })).toBeEnabled();
  });

  test('clearing the title after filling both fields disables send button', async ({ page }) => {
    await page.getByLabel('Titel').fill('Test-Titel');
    await page.getByLabel('Nachricht').fill('Test-Nachricht');
    await expect(page.getByRole('button', { name: 'An alle senden' })).toBeEnabled();

    await page.getByLabel('Titel').clear();
    await expect(page.getByRole('button', { name: 'An alle senden' })).toBeDisabled();
  });

  test('sending a notification shows success feedback and clears fields', async ({ page }) => {
    await page.getByLabel('Titel').fill('Probenerinnerung');
    await page.getByLabel('Nachricht').fill('Bitte denkt an die Probe heute Abend!');

    const sendButton = page.getByRole('button', { name: 'An alle senden' });
    await expect(sendButton).toBeEnabled();
    await sendButton.click();

    // "Gesendet ✓" appears after successful send
    await expect(page.getByText('Gesendet ✓')).toBeVisible();

    // Both fields are cleared after sending
    await expect(page.getByLabel('Titel')).toHaveValue('');
    await expect(page.getByLabel('Nachricht')).toHaveValue('');
  });

  test('optional URL field is not required for sending', async ({ page }) => {
    await page.getByLabel('Titel').fill('Test-Titel');
    await page.getByLabel('Nachricht').fill('Test-Nachricht');
    // Leave the URL field empty — button must still be enabled
    await expect(page.getByRole('button', { name: 'An alle senden' })).toBeEnabled();
  });
});
