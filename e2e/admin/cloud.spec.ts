import { expect, test } from '@playwright/test';
import { authStatePaths, backendUrl, e2eConfig } from '../config';
import { getAdminToken } from '../helpers/api';
import { CLOUD_FIXTURE_URL, mockCloudProvider } from '../helpers/cloud';

test('admin saves, updates, and clears member Cloud configuration', async ({ page, browser }) => {
  const token = await getAdminToken();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const endpoint = backendUrl('/settings/cloud.url');
  const originalResponse = await fetch(endpoint, { headers });
  expect(originalResponse.ok).toBeTruthy();
  const original = await originalResponse.json() as { key: string; value: string | null };
  const memberContext = await browser.newContext({
    storageState: authStatePaths.member,
    baseURL: e2eConfig.baseUrl,
    ignoreHTTPSErrors: true,
    locale: 'de-DE',
  });
  const memberPage = await memberContext.newPage();
  await mockCloudProvider(memberPage);

  try {
    await page.goto('/admin/einstellungen/cloud');
    const input = page.getByTestId('cloud-url-input');
    await expect(input).toBeEnabled();
    await input.fill(CLOUD_FIXTURE_URL);
    const saveResponse = page.waitForResponse((response) =>
      response.request().method() === 'PUT' && new URL(response.url()).pathname.endsWith('/settings/cloud.url'),
    );
    await page.getByTestId('cloud-settings-save').click();
    expect((await saveResponse).status()).toBe(200);
    await expect(page.getByTestId('cloud-settings-saved')).toBeVisible();
    await page.reload();
    await expect(input).toHaveValue(CLOUD_FIXTURE_URL);

    await memberPage.goto('/cloud');
    await expect(memberPage.getByTestId('cloud-frame')).toHaveAttribute('src', CLOUD_FIXTURE_URL);
    await expect(memberPage.frameLocator('[data-testid="cloud-frame"]').getByRole('heading', { name: 'Cloud fixture' })).toBeVisible();

    const updatedUrl = `${CLOUD_FIXTURE_URL}?folder=choir`;
    await input.fill(updatedUrl);
    await page.getByTestId('cloud-settings-save').click();
    await expect(page.getByTestId('cloud-settings-saved')).toBeVisible();
    await memberPage.reload();
    await expect(memberPage.getByTestId('cloud-frame')).toHaveAttribute('src', updatedUrl);

    await input.fill('');
    const clearResponse = page.waitForResponse((response) =>
      response.request().method() === 'DELETE' && new URL(response.url()).pathname.endsWith('/settings/cloud.url'),
    );
    await page.getByTestId('cloud-settings-save').click();
    expect((await clearResponse).status()).toBe(204);
    await memberPage.reload();
    await expect(memberPage.getByText('Die Cloud ist noch nicht konfiguriert.')).toBeVisible();
    await expect(memberPage.getByTestId('cloud-frame')).toHaveCount(0);
  } finally {
    await memberContext.close();
    const restored = await fetch(endpoint, {
      method: original.value === null ? 'DELETE' : 'PUT',
      headers,
      ...(original.value === null ? {} : { body: JSON.stringify({ value: original.value }) }),
    });
    expect(restored.ok).toBeTruthy();
  }
});
