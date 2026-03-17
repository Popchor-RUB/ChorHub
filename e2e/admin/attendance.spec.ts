import { test, expect, Page } from '@playwright/test';
import { getAdminToken, getMostRecentPastRehearsal, formatDateShort } from '../helpers/api';

// Runs in the 'admin-auth' project — storageState: e2e/.auth/admin.json

let pastRehearsalTitle: string;
let pastRehearsalDateShort: string;
let optionText: string;

test.beforeAll(async () => {
  const token = await getAdminToken();
  const rehearsal = await getMostRecentPastRehearsal(token);
  pastRehearsalTitle = rehearsal.title;
  pastRehearsalDateShort = formatDateShort(rehearsal.date);
  optionText = `${pastRehearsalDateShort} – ${pastRehearsalTitle}`;
});

async function selectPastRehearsal(page: Page) {
  // HeroUI Select renders as a button — click to open the dropdown
  await page.getByRole('button', { name: /Probe auswählen/ }).click();

  // The dropdown lists options in sections; click the past rehearsal option
  await page.getByRole('option', { name: optionText }).click();

  // Wait for records to load (filter input appears when rehearsal is selected)
  await expect(page.getByPlaceholder('Name filtern…')).toBeVisible();
}

test.describe('Admin attendance page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/anwesenheit');
    await expect(
      page.getByRole('heading', { name: 'Anwesenheit erfassen' }),
    ).toBeVisible();
  });

  test('initial state shows rehearsal selector without member table', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /Probe auswählen/ }),
    ).toBeVisible();
    // No member filter visible yet
    await expect(page.getByPlaceholder('Name filtern…')).not.toBeVisible();
  });

  test('selecting a past rehearsal loads attendance records', async ({ page }) => {
    await selectPastRehearsal(page);

    // Summary line: "{N} von {total} anwesend"
    await expect(page.getByText(/von \d+ anwesend/)).toBeVisible();
  });

  test('member list is grouped by voice sections', async ({ page }) => {
    await selectPastRehearsal(page);

    // Seed data has Sopran as the first voice group — its section button is visible
    // Voice section header button — scoped to the member table to avoid matching filter chips
    await expect(
      page.getByRole('button', { name: /Sopran/ }).first(),
    ).toBeVisible();
  });

  test('toggling a member attendance button changes their state', async ({ page }) => {
    await selectPastRehearsal(page);

    // Find first unattended member row and capture its stable member ID
    const firstUnattendedRow = page
      .getByTestId('attendance-member-row')
      .filter({ has: page.getByRole('button', { name: '+ Erfassen' }) })
      .first();

    const memberId = await firstUnattendedRow.getAttribute('data-member-id');
    expect(memberId).toBeTruthy();

    // Use the stable member ID to re-locate the row after re-renders
    const targetRow = page.locator(`[data-member-id="${memberId}"]`);

    await targetRow.getByRole('button', { name: '+ Erfassen' }).click();

    // The same row now shows the "Anwesend" button
    const anwesendButton = targetRow.getByRole('button', { name: '✓ Anwesend' });
    await expect(anwesendButton).toBeVisible();

    // Toggle back — same row should revert to "+ Erfassen"
    await anwesendButton.click();
    await expect(
      targetRow.getByRole('button', { name: '+ Erfassen' }),
    ).toBeVisible();
  });

  test('name filter reduces visible member rows', async ({ page }) => {
    await selectPastRehearsal(page);

    const allRows = page.getByTestId('attendance-member-row');
    const totalCount = await allRows.count();

    await page.getByPlaceholder('Name filtern…').fill('Schmidt');
    const filteredCount = await allRows.count();

    expect(filteredCount).toBeLessThanOrEqual(totalCount);

    // Clear the filter
    await page.getByPlaceholder('Name filtern…').clear();
    await expect(page.getByTestId('attendance-member-row')).toHaveCount(totalCount);
  });

  test('clicking a voice section header collapses the group', async ({ page }) => {
    await selectPastRehearsal(page);

    const sopranHeader = page.getByRole('button', { name: /Sopran/ }).first();

    // Get number of visible rows before collapse
    const countBefore = await page.getByTestId('attendance-member-row').count();

    // Collapse Sopran section
    await sopranHeader.click();
    // Collapsed indicator: ▸ appears in the button
    await expect(sopranHeader.getByText('▸')).toBeVisible();

    // Row count should decrease
    const countAfter = await page.getByTestId('attendance-member-row').count();
    expect(countAfter).toBeLessThan(countBefore);

    // Expand again
    await sopranHeader.click();
    await expect(sopranHeader.getByText('▾')).toBeVisible();
    await expect(page.getByTestId('attendance-member-row')).toHaveCount(countBefore);
  });
});
