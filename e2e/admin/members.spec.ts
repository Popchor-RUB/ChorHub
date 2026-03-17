import { test, expect } from '@playwright/test';

// Runs in the 'admin-auth' project — storageState: e2e/.auth/admin.json

test.describe('Admin member overview', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/mitglieder');
    await expect(page.getByRole('heading', { name: 'Mitglieder' })).toBeVisible();
    // HeroUI Table renders as role="grid"; wait for first data row
    await expect(page.getByRole('row').nth(1)).toBeVisible({ timeout: 15_000 });
  });

  test('displays all required table columns', async ({ page }) => {
    // HeroUI Table renders column headers as role="columnheader" inside role="row"
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('columnheader', { name: 'E-Mail' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Stimme' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Proben' })).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Unentsch. gefehlt' }),
    ).toBeVisible();
  });

  test('shows 200 seeded members (201 rows including header)', async ({ page }) => {
    await expect(page.getByRole('row')).toHaveCount(201);
  });

  test('clicking a member row opens the detail modal', async ({ page }) => {
    const firstRow = page.getByRole('row').nth(1);
    await firstRow.click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

    // Modal shows attendance summary chips
    await expect(modal.getByText(/\d+ anwesend/)).toBeVisible();
    await expect(modal.getByText(/\d+ unentschuldigt gefehlt/)).toBeVisible();
  });

  test('member detail modal contains rehearsal history', async ({ page }) => {
    const firstRow = page.getByRole('row').nth(1);
    await firstRow.click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

    // Wait for the spinner inside the modal to disappear
    await expect(modal.getByRole('status')).not.toBeVisible({ timeout: 8000 });

    // At least one rehearsal section should be present (seed data guarantees this)
    const hasPast = await modal
      .getByText('Vergangene Proben')
      .isVisible()
      .catch(() => false);
    const hasUpcoming = await modal
      .getByText('Bevorstehende Proben')
      .isVisible()
      .catch(() => false);
    expect(hasPast || hasUpcoming).toBeTruthy();
  });

  test('pressing Escape closes the detail modal', async ({ page }) => {
    await page.getByRole('row').nth(1).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('search input filters the member list', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Name suchen…');

    // Search for a common German surname guaranteed to appear in 200 members
    await searchInput.fill('Müller');

    const rowCount = await page.getByRole('row').count();
    // Some Müllers exist in 200 members; count is less than full 201
    expect(rowCount).toBeLessThan(201);
    // But at least the header + 1 member
    expect(rowCount).toBeGreaterThanOrEqual(2);

    // Clear search restores all members
    await searchInput.clear();
    await expect(page.getByRole('row')).toHaveCount(201);
  });

  test('voice filter chips are visible after members load', async ({ page }) => {
    const chips = page.getByTestId('voice-filter-chips');
    await expect(chips).toBeVisible();

    const voices = ['Alle', 'Sopran', 'Mezzosopran', 'Alt', 'Tenor', 'Bariton', 'Bass'];
    for (const voice of voices) {
      await expect(chips.getByText(voice, { exact: true })).toBeVisible();
    }
  });

  test('clicking a voice chip filters the table to that voice only', async ({ page }) => {
    // Sopran has 52 members in seed data → 52 data rows + 1 header = 53
    const chips = page.getByTestId('voice-filter-chips');
    await chips.getByText('Sopran', { exact: true }).click();

    await expect(page.getByRole('row')).toHaveCount(53);
  });

  test('clicking the active voice chip again resets the filter', async ({ page }) => {
    const chips = page.getByTestId('voice-filter-chips');
    await chips.getByText('Sopran', { exact: true }).click();
    await expect(page.getByRole('row')).toHaveCount(53);

    // Click the same chip again to deactivate
    await chips.getByText('Sopran', { exact: true }).click();
    await expect(page.getByRole('row')).toHaveCount(201);
  });

  test('clicking "Alle" resets the voice filter', async ({ page }) => {
    const chips = page.getByTestId('voice-filter-chips');
    await chips.getByText('Alt', { exact: true }).click();
    // Alt has 38 members → 39 rows
    await expect(page.getByRole('row')).toHaveCount(39);

    await chips.getByText('Alle', { exact: true }).click();
    await expect(page.getByRole('row')).toHaveCount(201);
  });

  test('voice filter and search input work together', async ({ page }) => {
    const chips = page.getByTestId('voice-filter-chips');
    // Activate Sopran filter (52 members)
    await chips.getByText('Sopran', { exact: true }).click();
    await expect(page.getByRole('row')).toHaveCount(53);

    // Further narrow by name
    await page.getByPlaceholder('Name suchen…').fill('a');
    const filteredCount = await page.getByRole('row').count();
    expect(filteredCount).toBeLessThan(53);
    expect(filteredCount).toBeGreaterThanOrEqual(2);

    // Clear name filter restores Sopran-only view
    await page.getByPlaceholder('Name suchen…').clear();
    await expect(page.getByRole('row')).toHaveCount(53);
  });
});
