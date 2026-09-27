import { expect, test } from '@playwright/test';
import { createMember, getAdminToken, getMembers, setMemberDisabled } from '../helpers/api';

test.describe.configure({ mode: 'serial' });

test.describe('Admin member status', () => {
  let adminToken: string;
  let memberId: string;
  let memberEmail: string;
  const reason = 'E2E manual disable reason';

  test.beforeAll(async () => {
    adminToken = await getAdminToken();
    const created = await createMember(adminToken, {
      firstName: 'Status',
      lastName: 'E2E',
      email: `status.${Date.now()}@test.de`,
    });
    memberId = created.id;
    memberEmail = created.email;
  });

  test.afterAll(async () => {
    if (memberId) await setMemberDisabled(adminToken, memberId, true, 'E2E test cleanup').catch(() => {});
  });

  test('manual disable stores reason, Disabled filter reveals member, and enable retains reason', async ({ page }) => {
    const activeBefore = await getMembers(adminToken);
    expect(activeBefore.some((member) => member.id === memberId)).toBeTruthy();

    await page.goto('/admin/mitglieder');
    await expect(page.getByTestId('members-status-active')).toBeVisible();
    await page.getByPlaceholder('Name suchen…').fill(memberEmail);

    const activeRow = page.getByRole('row').filter({ hasText: memberEmail });
    await expect(activeRow).toBeVisible();
    await activeRow.click();
    const modal = page.getByRole('dialog', { name: /Status E2E/ });
    await expect(modal).toBeVisible();
    await modal.getByTestId('member-status-toggle').click();
    await page.getByTestId('member-disable-reason').fill(reason);
    await page.getByTestId('member-disable-confirm').click();
    await expect(modal).not.toBeVisible();

    await expect(page.getByRole('row').filter({ hasText: memberEmail })).toHaveCount(0);
    await page.getByTestId('members-status-disabled').click();
    await page.getByPlaceholder('Name suchen…').fill(memberEmail);
    const disabledRow = page.getByRole('row').filter({ hasText: memberEmail });
    await expect(disabledRow).toBeVisible();

    const detailUrl = `/admin/mitglieder/${memberId}`;
    await page.goto(detailUrl);
    const statusPanel = page.getByTestId('member-disable-status');
    await expect(statusPanel).toContainText(reason);
    await expect(statusPanel).toContainText(/deaktiviert/i);

    await page.goto(detailUrl);
    await page.getByTestId('member-disable-status').getByTestId('member-status-toggle').click();
    await expect(page.getByTestId('member-disable-status')).toContainText(/aktiv/i);
    await expect.poll(async () => (await getMembers(adminToken)).some((member) => member.id === memberId)).toBeTruthy();
    await expect(page.getByTestId('member-disable-status')).toContainText(reason);
  });
});
