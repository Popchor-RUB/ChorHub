import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export const CLOUD_FIXTURE_URL = 'https://cloud-fixture.example.test/files';

export async function mockCloudProvider(page: Page): Promise<void> {
  await page.route('https://cloud-fixture.example.test/**', async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html><body style="margin:0"><h1>Cloud fixture</h1><div style="height:2000px">Scrollable files</div></body></html>',
    });
  });
}

export async function expectCloudViewport(page: Page): Promise<void> {
  const frame = page.getByTestId('cloud-frame');
  await expect(frame).toBeVisible();
  await expect(page.frameLocator('[data-testid="cloud-frame"]').getByRole('heading', { name: 'Cloud fixture' })).toBeVisible();

  await expect.poll(async () => {
    const header = await page.locator('header').boundingBox();
    const iframe = await frame.boundingBox();
    const viewport = page.viewportSize();
    if (!header || !iframe || !viewport) return null;
    const bottomNav = await page.getByTestId('member-bottom-nav').boundingBox();
    const bottom = bottomNav?.y ?? viewport.height;
    return {
      leftGap: Math.round(Math.abs(iframe.x)),
      widthGap: Math.round(Math.abs(iframe.width - viewport.width)),
      topGap: Math.round(Math.abs(iframe.y - (header.y + header.height))),
      bottomGap: Math.round(Math.abs(iframe.y + iframe.height - bottom)),
    };
  }).toEqual({ leftGap: 0, widthGap: 0, topGap: 0, bottomGap: 0 });

  const overflow = await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth > window.innerWidth + 1,
    vertical: document.documentElement.scrollHeight > window.innerHeight + 1,
  }));
  expect(overflow).toEqual({ horizontal: false, vertical: false });
}
