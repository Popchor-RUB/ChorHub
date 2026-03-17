import { test, expect } from '@playwright/test';
import { getAdminToken, getFirstMember, getFirstUpcomingRehearsal } from '../helpers/api';

// Runs in the 'member-auth' project — storageState: e2e/.auth/member.json

let upcomingRehearsalTitle: string;
let memberFullName: string; // "LastName, FirstName" as shown in member tables

test.beforeAll(async () => {
  const token = await getAdminToken();
  const [rehearsal, member] = await Promise.all([
    getFirstUpcomingRehearsal(token),
    getFirstMember(token),
  ]);
  upcomingRehearsalTitle = rehearsal.title;
  memberFullName = `${member.lastName}, ${member.firstName}`;
});

test.describe.configure({ mode: 'serial' });

test.describe('Member rehearsal page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/proben');
    await expect(page.getByRole('heading', { name: 'Proben' })).toBeVisible();
    // Wait for rehearsal list to load
    await expect(page.getByText(/Bevorstehend \(\d+\)/)).toBeVisible();
  });

  test('displays upcoming rehearsals list', async ({ page }) => {
    const upcomingSection = page.getByText(/Bevorstehend \(\d+\)/);
    await expect(upcomingSection).toBeVisible();

    // At least one upcoming card is present — identified by "Ich komme" button
    await expect(
      page.getByRole('button', { name: 'Ich komme', exact: true }).first(),
    ).toBeVisible();
  });

  test('displays past rehearsals section', async ({ page }) => {
    await expect(page.getByText(/Vergangen \(\d+\)/)).toBeVisible();
    // Past cards show the "Vergangen" chip
    await expect(page.getByText('Vergangen').first()).toBeVisible();
  });

  test('set CONFIRMED plan on first upcoming rehearsal', async ({ page }) => {
    const firstCard = page.getByTestId('rehearsal-card').first();

    // If already CONFIRMED, reset to neutral first
    if (await firstCard.getByText('Zugesagt').isVisible().catch(() => false)) {
      await firstCard.getByRole('button', { name: 'Ich komme', exact: true }).click();
      await expect(firstCard.getByText('Keine Angabe')).toBeVisible();
    }

    await firstCard.getByRole('button', { name: 'Ich komme', exact: true }).click();
    await expect(firstCard.getByText('Zugesagt')).toBeVisible();
  });

  test('set DECLINED plan on second upcoming rehearsal', async ({ page }) => {
    const cards = page.getByTestId('rehearsal-card');
    const secondCard = cards.nth(1);

    // Reset to neutral if currently DECLINED
    if (await secondCard.getByText('Abgesagt').isVisible().catch(() => false)) {
      await secondCard.getByRole('button', { name: 'Ich komme nicht' }).click();
      await expect(secondCard.getByText('Keine Angabe')).toBeVisible();
    }

    await secondCard.getByRole('button', { name: 'Ich komme nicht' }).click();
    await expect(secondCard.getByText('Abgesagt')).toBeVisible();
  });

  test('clicking the same plan button twice removes the plan', async ({ page }) => {
    const firstCard = page.getByTestId('rehearsal-card').first();
    const confirmButton = firstCard.getByRole('button', { name: 'Ich komme', exact: true });

    // Ensure plan is not already CONFIRMED
    if (await firstCard.getByText('Zugesagt').isVisible().catch(() => false)) {
      await confirmButton.click();
      await expect(firstCard.getByText('Keine Angabe')).toBeVisible();
    }

    // Set CONFIRMED
    await confirmButton.click();
    await expect(firstCard.getByText('Zugesagt')).toBeVisible();

    // Toggle off
    await confirmButton.click();
    await expect(firstCard.getByText('Keine Angabe')).toBeVisible();
  });

  test('past rehearsal buttons are disabled', async ({ page }) => {
    const pastSection = page.locator('section').filter({ has: page.getByText(/Vergangen \(\d+\)/) });
    const pastCard = pastSection.getByTestId('rehearsal-card').first();

    await expect(
      pastCard.getByRole('button', { name: 'Ich komme', exact: true }),
    ).toBeDisabled();
    await expect(
      pastCard.getByRole('button', { name: 'Ich komme nicht' }),
    ).toBeDisabled();
  });

  test('cross-role: CONFIRMED plan is visible in admin attendance view', async ({ page, browser }) => {
    // Step 1: Set CONFIRMED plan as member
    const firstCard = page.getByTestId('rehearsal-card').first();

    // Ensure CONFIRMED is set (handle any existing state)
    const isConfirmed = await firstCard.getByText('Zugesagt').isVisible().catch(() => false);
    if (!isConfirmed) {
      // Clear DECLINED if set
      if (await firstCard.getByText('Abgesagt').isVisible().catch(() => false)) {
        await firstCard.getByRole('button', { name: 'Ich komme nicht' }).click();
        await expect(firstCard.getByText('Keine Angabe')).toBeVisible();
      }
      await firstCard.getByRole('button', { name: 'Ich komme', exact: true }).click();
      await expect(firstCard.getByText('Zugesagt')).toBeVisible();
    }

    // Step 2: Open admin context
    const adminContext = await browser.newContext({
      storageState: 'e2e/.auth/admin.json',
      locale: 'de-DE',
    });
    const adminPage = await adminContext.newPage();

    try {
      // Step 3: Verify member shows "✓ zugesagt" in /admin/proben rehearsal modal
      await adminPage.goto('/admin/proben');
      await expect(
        adminPage.getByRole('heading', { name: 'Probenübersicht' }),
      ).toBeVisible();

      // Click the upcoming rehearsal card (default tab is "Bevorstehend")
      await adminPage.getByText(upcomingRehearsalTitle).first().click();

      const rehearsalDialog = adminPage.getByRole('dialog');

      // Voice sections are collapsed by default — expand all of them first
      const collapsedHeaders = rehearsalDialog.getByRole('button').filter({ hasText: '▸' });
      const collapsedCount = await collapsedHeaders.count();
      for (let i = 0; i < collapsedCount; i++) {
        await collapsedHeaders.first().click();
      }

      await expect(rehearsalDialog.getByText(memberFullName, { exact: true })).toBeVisible();
      // The status span is a sibling of the name span inside the same row div
      const memberNameInRehearsal = rehearsalDialog.getByText(memberFullName, { exact: true });
      await expect(memberNameInRehearsal.locator('..').getByText('✓ zugesagt')).toBeVisible();
      await adminPage.keyboard.press('Escape');

      // Step 4: Verify rehearsal shows "✓ zugesagt" in /admin/mitglieder member modal
      await adminPage.goto('/admin/mitglieder');
      await expect(
        adminPage.getByRole('heading', { name: 'Mitglieder' }),
      ).toBeVisible();

      // Search for the member and open their modal
      const [lastName] = memberFullName.split(', ');
      await adminPage.getByPlaceholder('Name suchen…').fill(lastName);
      await adminPage.getByText(memberFullName, { exact: true }).click();

      const memberDialog = adminPage.getByRole('dialog');
      // The upcoming rehearsal row shows the title and plan status as siblings
      const rehearsalTitleEl = memberDialog.getByText(
        new RegExp(`${upcomingRehearsalTitle}`),
      ).first();
      await expect(rehearsalTitleEl.locator('..').getByText('✓ zugesagt')).toBeVisible();
    } finally {
      await adminContext.close();
    }
  });
});
