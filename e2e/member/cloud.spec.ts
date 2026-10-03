import { expect, test } from '@playwright/test';
import { CLOUD_FIXTURE_URL, expectCloudViewport, mockCloudProvider } from '../helpers/cloud';

test.describe('Member Cloud', () => {
  test('fills available viewport while navigation remains usable', async ({ page }) => {
    await mockCloudProvider(page);
    await page.route(/\/settings\/cloud\.url$/, async (route) => {
      await route.fulfill({ json: { key: 'cloud.url', value: CLOUD_FIXTURE_URL } });
    });
    await page.route(/\/members\/me$/, async (route) => {
      await route.fulfill({ json: { voiceAdminVoices: [{ id: 'cloud-voice', name: 'Cloud voice' }] } });
    });

    await page.goto('/cloud');
    for (const width of [1280, 768, 640, 390, 320]) {
      await page.setViewportSize({ width, height: 720 });
      await expectCloudViewport(page);
      await expect(page.getByRole('link', { name: 'Cloud', exact: true })).toBeVisible();
      if (width < 640) {
        const navigation = page.getByTestId('member-bottom-nav');
        await expect(navigation.getByRole('link')).toHaveCount(5);
        await expect(navigation.getByTestId('voice-admin-nav')).toBeVisible();
        const links = navigation.getByRole('link');
        for (const link of await links.all()) {
          const box = await link.boundingBox();
          if (!box) throw new Error('Member navigation link has no visible bounds');
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
        }
      }
    }

    // Simulate a nonzero home-bar inset: iframe must follow the actual nav height.
    await page.addStyleTag({ content: '[data-testid="member-bottom-nav"] { padding-bottom: 20px !important; }' });
    await page.setViewportSize({ width: 390, height: 844 });
    await expectCloudViewport(page);

    await page.getByTestId('member-bottom-nav').getByRole('link', { name: 'Proben', exact: true }).click();
    await expect(page).toHaveURL(/\/proben$/);
    await expect(page.getByTestId('cloud-frame')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Proben', exact: true })).toBeVisible();
  });

  test('keeps Cloud navigation visible without a configured URL', async ({ page }) => {
    await page.route(/\/settings\/cloud\.url$/, async (route) => {
      await route.fulfill({ json: { key: 'cloud.url', value: null } });
    });
    await page.goto('/cloud');
    await expect(page.getByText('Die Cloud ist noch nicht konfiguriert.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Cloud', exact: true })).toBeVisible();
    await expect(page.getByTestId('cloud-frame')).toHaveCount(0);
  });

  test('retries failed configuration requests', async ({ page }) => {
    await mockCloudProvider(page);
    let available = false;
    await page.route(/\/settings\/cloud\.url$/, async (route) => {
      if (!available) {
        await route.fulfill({ status: 503, json: { error: { message: 'Unavailable' } } });
      } else {
        await route.fulfill({ json: { key: 'cloud.url', value: CLOUD_FIXTURE_URL } });
      }
    });
    await page.goto('/cloud');
    await expect(page.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible();
    available = true;
    await page.getByRole('button', { name: 'Erneut versuchen' }).click();
    await expectCloudViewport(page);
  });
});
