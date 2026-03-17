import { test, expect } from '@playwright/test';
import { getAdminToken, createMember, deleteMember, getMemberRehearsals, getAllRehearsals } from '../helpers/api';

// Runs in the 'admin-auth' project — storageState: e2e/.auth/admin.json
// Serial mode prevents parallel create/delete tests from interfering with row-count assertions
test.describe.configure({ mode: 'serial' });

const TEST_EMAILS = ['eva.braun.e2e@test.de', 'plan.test.e2e@test.de'];

// Clean up any leftover test members before the suite runs (handles previous failed runs)
test.beforeAll(async () => {
  const token = await getAdminToken();
  const members = await fetch('http://localhost:3000/admin/members', {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json()) as { id: string; email: string }[];
  for (const m of members) {
    if (TEST_EMAILS.includes(m.email)) {
      await deleteMember(token, m.id).catch(() => {});
    }
  }
});

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

  test('shows 205 seeded members (206 rows including header)', async ({ page }) => {
    await expect(page.getByRole('row')).toHaveCount(206);
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
    // Some Müllers exist in 205 members; count is less than full 206
    expect(rowCount).toBeLessThan(206);
    // But at least the header + 1 member
    expect(rowCount).toBeGreaterThanOrEqual(2);

    // Clear search restores all members
    await searchInput.clear();
    await expect(page.getByRole('row')).toHaveCount(206);
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
    await expect(page.getByRole('row')).toHaveCount(206);
  });

  test('clicking "Alle" resets the voice filter', async ({ page }) => {
    const chips = page.getByTestId('voice-filter-chips');
    await chips.getByText('Alt', { exact: true }).click();
    // Alt has 38 members → 39 rows
    await expect(page.getByRole('row')).toHaveCount(39);

    await chips.getByText('Alle', { exact: true }).click();
    await expect(page.getByRole('row')).toHaveCount(206);
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
      await deleteMember(adminToken, createdMemberId).catch(() => {});
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
    await modal.getByLabel('E-Mail').fill('eva.braun.e2e@test.de');
    await modal.getByRole('button', { name: 'Anlegen & E-Mail senden' }).click();

    await expect(modal).not.toBeVisible({ timeout: 10_000 });

    await expect(page.getByRole('row')).toHaveCount(initialRowCount + 1, { timeout: 10_000 });

    // Fetch the created id for cleanup
    const members = await fetch('http://localhost:3000/admin/members', {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.json()) as { id: string; email: string }[];
    const created = members.find((m) => m.email === 'eva.braun.e2e@test.de');
    if (created) createdMemberId = created.id;
  });

  test('shows error when email is already taken', async ({ page }) => {
    // Get an existing member's email
    const members = await fetch('http://localhost:3000/admin/members', {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.json()) as { email: string }[];
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
      email: 'plan.test.e2e@test.de',
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
