import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

for (const width of [1280, 390]) {
  test(`voice admin navigation stays visible during refresh at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem('chorhub-auth', JSON.stringify({
        state: {
          memberSession: {
            token: 'navigation-test-token',
            memberId: 'navigation-test-member',
            firstName: 'Navigation',
            lastName: 'Test',
          },
          adminSession: null,
        },
        version: 0,
      }));
    });

    let revoked = false;
    let refreshGate = Promise.resolve();
    await page.route(/\/members\/me$/, async (route) => {
      await refreshGate;
      await route.fulfill({ json: {
        voiceAdminVoices: revoked ? [] : [{ id: 'test-voice', name: 'Test voice' }],
      } });
    });
    await page.route(/\/settings\/cloud\.url$/, (route) =>
      route.fulfill({ json: { key: 'cloud.url', value: null } }));
    await page.route(/\/general-info$/, (route) => route.fulfill({ json: null }));
    await page.route(/\/personal-info\/me$/, (route) => route.fulfill({ json: null }));

    await page.goto('/cloud');
    const navigation = width < 640
      ? page.getByTestId('member-bottom-nav')
      : page.getByRole('navigation', { name: 'ChorHub' });
    const attendanceTab = navigation.getByTestId('voice-admin-nav');
    await expect(attendanceTab).toBeVisible();

    for (const path of ['/informationen', '/cloud']) {
      let releaseRefresh = () => {};
      refreshGate = new Promise<void>((resolve) => { releaseRefresh = resolve; });
      const refreshRequest = page.waitForRequest(/\/members\/me$/);
      try {
        await navigation.locator(`a[href="${path}"]`).click();
        await refreshRequest;
        await expect(page).toHaveURL(new RegExp(`${path}$`));
        await expect(attendanceTab).toBeVisible();
      } finally {
        releaseRefresh();
      }
      await expect(attendanceTab).toBeVisible();
    }

    revoked = true;
    await navigation.locator('a[href="/informationen"]').click();
    await expect(page.getByTestId('voice-admin-nav')).toHaveCount(0);
  });
}
