import { expect, test } from '@playwright/test';
import { createMember, getAdminToken, setMemberDisabled } from '../helpers/api';

test('admin edits and clears a member comment in active and disabled views', async ({ page }) => {
  const adminToken = await getAdminToken();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const member = await createMember(adminToken, {
    firstName: 'Kommentar',
    lastName: suffix,
    email: `comment-${suffix}@example.test`,
  });
  const memberName = `${member.firstName} ${member.lastName}`;

  const openMember = async () => {
    await page.getByRole('row').filter({ hasText: memberName }).click();
    const dialog = page.getByRole('dialog').filter({ has: page.getByTestId('member-comment-toggle') });
    await expect(dialog).toBeVisible();
    return dialog;
  };

  const saveComment = async (comment: string) => {
    const dialog = await openMember();
    await dialog.getByTestId('member-comment-toggle').click();
    const commentDialog = page.getByRole('dialog', { name: 'Mitgliederkommentar bearbeiten' });
    await expect(commentDialog).toBeVisible();
    await commentDialog.getByTestId('member-comment-input').fill(comment);
    await commentDialog.getByTestId('member-comment-save').click();
    await expect(commentDialog).not.toBeVisible();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).not.toBeVisible();
  };

  await page.goto('/admin/mitglieder');
  const row = page.getByRole('row').filter({ hasText: memberName });
  await expect(row).toBeVisible();
  await expect(row.getByTestId('member-comment-indicator')).toHaveCount(0);

  await saveComment('  Erste Notiz  ');
  const indicator = row.getByTestId('member-comment-indicator');
  await expect(indicator).toBeVisible();
  await indicator.focus();
  await expect(page.getByRole('tooltip')).toHaveText('Erste Notiz');
  await indicator.hover();
  await expect(page.getByRole('tooltip')).toHaveText('Erste Notiz');

  await page.setViewportSize({ width: 390, height: 844 });
  await indicator.click();
  const commentDialog = page.getByRole('dialog', { name: 'Interner Kommentar' });
  await expect(commentDialog).toContainText('Erste Notiz');
  await expect(page.getByRole('dialog').filter({ has: page.getByTestId('member-comment-toggle') })).toHaveCount(0);
  await commentDialog.getByRole('button', { name: 'Close' }).click();
  await expect(commentDialog).not.toBeVisible();
  await page.setViewportSize({ width: 1280, height: 720 });

  await saveComment('Aktualisierte Notiz');
  await indicator.hover();
  await expect(page.getByRole('tooltip')).toHaveText('Aktualisierte Notiz');

  await saveComment('   ');
  await expect(row.getByTestId('member-comment-indicator')).toHaveCount(0);

  await setMemberDisabled(adminToken, member.id, true, 'E2E comment check');
  await page.getByTestId('members-status-disabled').click();
  await expect(row).toBeVisible();
  await saveComment('Notiz für deaktiviertes Mitglied');
  await expect(row.getByTestId('member-comment-indicator')).toBeVisible();
});
