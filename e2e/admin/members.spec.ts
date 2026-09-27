import { test, expect } from '@playwright/test';
import {
  getAdminToken,
  getFirstMember,
  createMember,
  getMembers,
  setMemberDisabled,
  getMemberRehearsals,
  getAllRehearsals,
} from '../helpers/api';

// Runs in the 'admin-auth' project with the configured admin storage state.
// Serial mode prevents parallel create/disable tests from interfering with row-count assertions
test.describe.configure({ mode: 'serial' });

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

  test('shows active members returned by the overview API', async ({ page }) => {
    const token = await getAdminToken();
    const activeMembers = await getMembers(token);
    await expect(page.getByRole('row')).toHaveCount(activeMembers.length + 1);
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
    const firstMember = await getFirstMember(await getAdminToken());
    const initialRowCount = await page.getByRole('row').count();
    await searchInput.fill(`${firstMember.firstName} ${firstMember.lastName}`);
    await expect.poll(() => page.getByRole('row').count()).toBeLessThan(initialRowCount);
    const rowCount = await page.getByRole('row').count();
    expect(rowCount).toBeGreaterThanOrEqual(2);

    // Clear search restores all members
    await searchInput.clear();
    await expect(page.getByRole('row')).toHaveCount(initialRowCount);
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
    const totalRows = await page.getByRole('row').count();
    const chips = page.getByTestId('voice-filter-chips');
    await chips.getByText('Sopran', { exact: true }).click();
    const rows = page.getByRole('row');
    await expect(rows).not.toHaveCount(totalRows);
    const dataRows = rows.filter({ has: page.getByRole('gridcell') });
    const count = await dataRows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(dataRows.nth(i)).toContainText('Sopran');
    }
  });

  test('clicking the active voice chip again resets the filter', async ({ page }) => {
    const totalRows = await page.getByRole('row').count();
    const chips = page.getByTestId('voice-filter-chips');
    await chips.getByText('Sopran', { exact: true }).click();
    await expect(page.getByRole('row')).not.toHaveCount(totalRows);

    // Click the same chip again to deactivate
    await chips.getByText('Sopran', { exact: true }).click();
    await expect(page.getByRole('row')).toHaveCount(totalRows);
  });

  test('clicking "Alle" resets the voice filter', async ({ page }) => {
    const totalRows = await page.getByRole('row').count();
    const chips = page.getByTestId('voice-filter-chips');
    await chips.getByText('Alt', { exact: true }).click();
    await expect(page.getByRole('row')).not.toHaveCount(totalRows);

    await chips.getByText('Alle', { exact: true }).click();
    await expect(page.getByRole('row')).toHaveCount(totalRows);
  });

  test('voice filter and search input work together', async ({ page }) => {
    const totalRows = await page.getByRole('row').count();
    const chips = page.getByTestId('voice-filter-chips');
    await chips.getByText('Sopran', { exact: true }).click();
    await expect(page.getByRole('row')).not.toHaveCount(totalRows);
    const filteredByVoiceOnlyCount = await page.getByRole('row').count();

    // Further narrow by name
    await page.getByPlaceholder('Name suchen…').fill('a');
    const filteredCount = await page.getByRole('row').count();
    expect(filteredCount).toBeLessThanOrEqual(filteredByVoiceOnlyCount);
    expect(filteredCount).toBeGreaterThanOrEqual(2);

    // Clear name filter restores Sopran-only view
    await page.getByPlaceholder('Name suchen…').clear();
    await expect(page.getByRole('row')).toHaveCount(filteredByVoiceOnlyCount);
  });
});

test.describe('Create member modal', () => {
  let adminToken: string;
  let createdMemberId: string | undefined;

  test.beforeAll(async () => {
    adminToken = await getAdminToken();
  });

  test.beforeEach(async ({ page }) => {
    createdMemberId = undefined;
    await page.goto('/admin/mitglieder');
    await expect(page.getByRole('heading', { name: 'Mitglieder' })).toBeVisible();
    await expect(page.getByRole('row').nth(1)).toBeVisible({ timeout: 15_000 });
  });

  test.afterEach(async () => {
    if (createdMemberId) {
      await setMemberDisabled(adminToken, createdMemberId, true, 'E2E test cleanup').catch(() => {});
    }
  });

  test('"+ Neu" button opens the create member modal', async ({ page }) => {
    await page.getByRole('button', { name: '+ Neu' }).click();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Mitglied anlegen')).toBeVisible();
  });

  test('modal can be closed with Abbrechen', async ({ page }) => {
    await page.getByRole('button', { name: '+ Neu' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Abbrechen' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('create button is disabled until all required fields are filled', async ({ page }) => {
    await page.getByRole('button', { name: '+ Neu' }).click();
    const submitBtn = page.getByRole('button', { name: 'Anlegen & E-Mail senden' });
    await expect(submitBtn).toBeDisabled();

    await page.getByLabel('Vorname').fill('Eva');
    await expect(submitBtn).toBeDisabled();

    await page.getByLabel('Nachname').fill('Braun');
    await expect(submitBtn).toBeDisabled();

    await page.getByLabel('E-Mail').fill('eva@test.de');
    await expect(submitBtn).toBeEnabled();
  });

  test('successfully creates a new member and shows it in the table', async ({ page }) => {
    const initialRowCount = await page.getByRole('row').count();

    await page.getByRole('button', { name: '+ Neu' }).click();
    const modal = page.getByRole('dialog');

    await modal.getByLabel('Vorname').fill('Eva');
    await modal.getByLabel('Nachname').fill('Braun');
    const email = `eva.braun.${Date.now()}.e2e@test.de`;
    await modal.getByLabel('E-Mail').fill(email);
    await modal.getByRole('button', { name: 'Anlegen & E-Mail senden' }).click();

    await expect(modal).not.toBeVisible({ timeout: 10_000 });

    await expect(page.getByRole('row')).toHaveCount(initialRowCount + 1, { timeout: 10_000 });

    // Fetch the created id for cleanup
    const created = (await getMembers(adminToken)).find((m) => m.email === email);
    if (created) {
      createdMemberId = created.id;
    }
  });

  test('shows error when email is already taken', async ({ page }) => {
    // Get an existing member's email
    const members = await getMembers(adminToken);
    const existingEmail = members[0].email;

    await page.getByRole('button', { name: '+ Neu' }).click();
    const modal = page.getByRole('dialog');

    await modal.getByLabel('Vorname').fill('Test');
    await modal.getByLabel('Nachname').fill('User');
    await modal.getByLabel('E-Mail').fill(existingEmail);
    await modal.getByRole('button', { name: 'Anlegen & E-Mail senden' }).click();

    await expect(modal.getByText('Diese E-Mail-Adresse ist bereits vergeben.')).toBeVisible();
    await expect(modal).toBeVisible();
  });

  test('new member has DECLINED plans for all past rehearsals', async () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const member = await createMember(adminToken, {
      firstName: 'Plan',
      lastName: 'Test',
      email: `plan.test.${Date.now()}.e2e@test.de`,
    });
    createdMemberId = member.id;

    const allRehearsals = await getAllRehearsals(adminToken);
    const pastRehearsals = allRehearsals.filter((r) => new Date(r.date) < now);

    const memberRehearsals = await getMemberRehearsals(adminToken, member.id);
    const declinedPlans = memberRehearsals.filter((r) => r.plan === 'DECLINED');

    expect(declinedPlans).toHaveLength(pastRehearsals.length);
    expect(memberRehearsals.filter((r) => r.plan !== 'DECLINED' && r.plan !== null)).toHaveLength(0);
  });
});
