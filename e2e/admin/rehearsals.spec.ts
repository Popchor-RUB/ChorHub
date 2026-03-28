import { test, expect } from '@playwright/test';
import type { Page, Locator } from '@playwright/test';
import {
  getAdminToken,
  getFirstUpcomingRehearsal,
  getMostRecentPastRehearsal,
} from '../helpers/api';

// Runs in the 'admin-auth' project — storageState: e2e/.auth/admin.json
let upcomingRehearsalTitle: string;
let pastRehearsalTitle: string;

async function chipCount(chip: Locator): Promise<number> {
  const text = (await chip.textContent()) ?? '';
  const match = text.match(/^\s*(\d+)/);
  return match ? Number(match[1]) : 0;
}

async function openRehearsalModalAndExpandGroups(
  page: Page,
  title: string,
): Promise<Locator> {
  await page.getByText(title, { exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('div.flex.flex-wrap.gap-2.mb-4').first()).toBeVisible();

  await expandAllGroups(dialog);
  return dialog;
}

async function expandAllGroups(dialog: Locator): Promise<void> {
  const collapsedHeaders = dialog.getByRole('button').filter({ hasText: '▸' });
  const collapsedCount = await collapsedHeaders.count();
  for (let i = 0; i < collapsedCount; i += 1) {
    await collapsedHeaders.nth(0).click();
  }
}

test.describe('Admin rehearsal overview page', () => {
  test.beforeAll(async () => {
    const token = await getAdminToken();
    const [upcoming, past] = await Promise.all([
      getFirstUpcomingRehearsal(token),
      getMostRecentPastRehearsal(token),
    ]);
    upcomingRehearsalTitle = upcoming.title;
    pastRehearsalTitle = past.title;
  });

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

  test('future rehearsal plan chips filter member rows', async ({ page }) => {
    const dialog = await openRehearsalModalAndExpandGroups(page, upcomingRehearsalTitle);
    const chipBar = dialog.locator('div.flex.flex-wrap.gap-2.mb-4').first();

    const confirmedChip = chipBar.getByRole('button').filter({ hasText: /\d+\s+zugesagt/i });
    const declinedChip = chipBar.getByRole('button').filter({ hasText: /\d+\s+abgesagt/i });
    const noResponseChip = chipBar.getByRole('button').filter({ hasText: /\d+\s+keine Angabe/i });

    const confirmedCount = await chipCount(confirmedChip);
    const declinedCount = await chipCount(declinedChip);
    const noResponseCount = await chipCount(noResponseChip);

    await confirmedChip.click();
    await expandAllGroups(dialog);
    await expect(dialog.getByText('✓ zugesagt', { exact: true })).toHaveCount(confirmedCount);
    await expect(dialog.getByText('✗ abgesagt', { exact: true })).toHaveCount(0);
    await expect(dialog.getByText('– keine Angabe', { exact: true })).toHaveCount(0);

    await declinedChip.click();
    await expandAllGroups(dialog);
    await expect(dialog.getByText('✓ zugesagt', { exact: true })).toHaveCount(0);
    await expect(dialog.getByText('✗ abgesagt', { exact: true })).toHaveCount(declinedCount);
    await expect(dialog.getByText('– keine Angabe', { exact: true })).toHaveCount(0);

    await noResponseChip.click();
    await expandAllGroups(dialog);
    await expect(dialog.getByText('✓ zugesagt', { exact: true })).toHaveCount(0);
    await expect(dialog.getByText('✗ abgesagt', { exact: true })).toHaveCount(0);
    await expect(dialog.getByText('– keine Angabe', { exact: true })).toHaveCount(noResponseCount);
  });

  test('past rehearsal attendance chips filter member rows', async ({ page }) => {
    await page.getByRole('tab', { name: /Vergangen \(/ }).click();
    const dialog = await openRehearsalModalAndExpandGroups(page, pastRehearsalTitle);
    const chipBar = dialog.locator('div.flex.flex-wrap.gap-2.mb-4').first();

    const presentChip = chipBar.getByRole('button').filter({ hasText: /\d+\s+anwesend/i });
    const unexcusedChip = chipBar.getByRole('button').filter({ hasText: /\d+\s+unentschuldigt gefehlt/i });
    const excusedChip = chipBar.getByRole('button').filter({ hasText: /\d+\s+entschuldigt/i });

    const presentCount = await chipCount(presentChip);
    const unexcusedCount = await chipCount(unexcusedChip);
    const excusedCount = await chipCount(excusedChip);

    await presentChip.click();
    await expandAllGroups(dialog);
    await expect(dialog.getByText('✓ anwesend', { exact: true })).toHaveCount(presentCount);
    await expect(dialog.getByText('✗ gefehlt', { exact: true })).toHaveCount(0);
    await expect(dialog.getByText('abgesagt', { exact: true })).toHaveCount(0);

    await unexcusedChip.click();
    await expandAllGroups(dialog);
    await expect(dialog.getByText('✓ anwesend', { exact: true })).toHaveCount(0);
    await expect(dialog.getByText('✗ gefehlt', { exact: true })).toHaveCount(unexcusedCount);
    await expect(dialog.getByText('abgesagt', { exact: true })).toHaveCount(0);

    await excusedChip.click();
    await expandAllGroups(dialog);
    await expect(dialog.getByText('✓ anwesend', { exact: true })).toHaveCount(0);
    await expect(dialog.getByText('✗ gefehlt', { exact: true })).toHaveCount(0);
    await expect(dialog.getByText('abgesagt', { exact: true })).toHaveCount(excusedCount);
  });
});
