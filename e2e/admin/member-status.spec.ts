import { expect, test } from '@playwright/test';
import { createMember, getAdminToken, getMembers, setMemberDisabled } from '../helpers/api';
import {
  decodeQuotedPrintable,
  getMailhogBodyForSubject,
  getMailhogMessagesForRecipient,
} from '../helpers/mailhog';

test.describe.configure({ mode: 'serial' });

const adminMailbox = 'admins@chorhub.test';
const memberNoticeSubject = 'Dein ChorHub Zugang wurde deaktiviert';

async function createStatusMember(adminToken: string, label: string) {
  return createMember(adminToken, {
    firstName: 'Status',
    lastName: label,
    email: `status.${label.toLowerCase()}.${Date.now()}@test.de`,
  });
}

async function expectAdminNotice(memberEmail: string, reason: string) {
  await expect.poll(async () => {
    const messages = await getMailhogMessagesForRecipient(adminMailbox);
    return messages.some((message) => {
      const body = decodeQuotedPrintable(message.Content.Body);
      return body.includes(memberEmail) && body.includes(reason);
    });
  }, { timeout: 15_000, intervals: [250, 500, 1000] }).toBeTruthy();
}

test.describe('Admin member status', () => {
  let adminToken: string;

  test.beforeAll(async () => {
    adminToken = await getAdminToken();
  });

  test('defaults and dependencies reset in member modal and detail view', async ({ page }) => {
    const member = await createStatusMember(adminToken, 'Controls');
    const reason = 'Checkbox dependency reason';

    await page.goto('/admin/mitglieder');
    await expect(page.getByTestId('members-status-active')).toBeVisible();
    await page.getByPlaceholder('Name suchen…').fill(member.email);
    const row = page.getByRole('row').filter({ hasText: member.email });
    await expect(row).toBeVisible();
    await row.click();

    const memberModal = page.getByRole('dialog', { name: /Status Controls/ });
    await expect(memberModal).toBeVisible();
    await memberModal.getByTestId('member-status-toggle').click();
    const notifyInModal = page.getByRole('checkbox', { name: 'Mitglied per E-Mail benachrichtigen' });
    const includeInModal = page.getByRole('checkbox', { name: 'Grund in E-Mail aufnehmen' });
    await expect(notifyInModal).toBeChecked();
    await expect(includeInModal).not.toBeChecked();
    await expect(includeInModal).toBeDisabled();

    await notifyInModal.focus();
    await notifyInModal.press('Space');
    await expect(notifyInModal).not.toBeChecked();
    await page.getByTestId('member-disable-reason').fill(reason);
    await expect(includeInModal).toBeDisabled();
    await notifyInModal.focus();
    await notifyInModal.press('Space');
    await expect(includeInModal).toBeEnabled();
    await includeInModal.focus();
    await includeInModal.press('Space');
    await expect(includeInModal).toBeChecked();
    await page.getByTestId('member-disable-reason').fill('   ');
    await expect(includeInModal).not.toBeChecked();
    await expect(includeInModal).toBeDisabled();

    await page.getByTestId('member-disable-reason').fill(reason);
    await includeInModal.focus();
    await includeInModal.press('Space');
    await page.route(`**/admin/members/${member.id}/status`, async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
    });
    await page.getByTestId('member-disable-confirm').click();
    await expect(memberModal.getByRole('alert')).toContainText('Mitgliedsstatus konnte nicht geändert werden');
    await expect(page.getByTestId('member-disable-reason')).toHaveValue(reason);
    await expect(notifyInModal).toBeChecked();
    await expect(includeInModal).toBeChecked();
    await page.unroute(`**/admin/members/${member.id}/status`);
    await page.getByRole('button', { name: 'Abbrechen' }).click();

    await memberModal.getByTestId('member-status-toggle').click();
    await expect(notifyInModal).toBeChecked();
    await expect(includeInModal).not.toBeChecked();

    await page.goto(`/admin/mitglieder/${member.id}`);
    const statusPanel = page.getByTestId('member-disable-status');
    await statusPanel.getByTestId('member-status-toggle').click();
    const detailDialog = page.getByRole('dialog', { name: 'Mitglied deaktivieren' });
    const notifyInDetail = detailDialog.getByRole('checkbox', { name: 'Mitglied per E-Mail benachrichtigen' });
    const includeInDetail = detailDialog.getByRole('checkbox', { name: 'Grund in E-Mail aufnehmen' });
    await expect(notifyInDetail).toBeChecked();
    await expect(includeInDetail).not.toBeChecked();
    await expect(includeInDetail).toBeDisabled();
    await page.getByRole('button', { name: 'Abbrechen' }).click();

    const activeMembers = await getMembers(adminToken);
    expect(activeMembers.some((entry) => entry.id === member.id)).toBeTruthy();
  });

  test('default notice omits reason, retains internal reason, and enabling retains it', async ({ page }) => {
    const member = await createStatusMember(adminToken, 'DefaultNotice');
    const reason = 'E2E default reason stays internal';
    const activeBefore = await getMembers(adminToken);
    expect(activeBefore.some((entry) => entry.id === member.id)).toBeTruthy();

    await page.goto('/admin/mitglieder');
    await page.getByPlaceholder('Name suchen…').fill(member.email);
    await page.getByRole('row').filter({ hasText: member.email }).click();
    const modal = page.getByRole('dialog', { name: /Status DefaultNotice/ });
    await modal.getByTestId('member-status-toggle').click();
    await page.getByTestId('member-disable-reason').fill(reason);
    const notify = page.getByRole('checkbox', { name: 'Mitglied per E-Mail benachrichtigen' });
    const includeReason = page.getByRole('checkbox', { name: 'Grund in E-Mail aufnehmen' });
    await expect(notify).toBeChecked();
    await expect(includeReason).not.toBeChecked();
    await page.getByTestId('member-disable-confirm').click();
    await expect(modal).not.toBeVisible();

    const memberBody = await getMailhogBodyForSubject(member.email, memberNoticeSubject);
    expect(memberBody).toContain('Dein Zugang zu ChorHub wurde deaktiviert');
    expect(memberBody).not.toContain(reason);
    expect(memberBody).not.toContain('Deaktivierungsgrund:');
    await expectAdminNotice(member.email, reason);

    await page.goto('/admin/mitglieder');
    await expect(page.getByRole('row').filter({ hasText: member.email })).toHaveCount(0);
    await page.getByTestId('members-status-disabled').click();
    await page.getByPlaceholder('Name suchen…').fill(member.email);
    await expect(page.getByRole('row').filter({ hasText: member.email })).toBeVisible();

    await page.goto(`/admin/mitglieder/${member.id}`);
    const statusPanel = page.getByTestId('member-disable-status');
    await expect(statusPanel).toContainText(reason);
    await expect(statusPanel).toContainText(/deaktiviert/i);
    await statusPanel.getByTestId('member-status-toggle').click();
    await expect(statusPanel).toContainText(/aktiv/i);
    await expect.poll(async () => (await getMembers(adminToken)).some((entry) => entry.id === member.id)).toBeTruthy();
    await expect(statusPanel).toContainText(reason);
  });

  test('notification can be disabled while internal admin notice still includes reason', async ({ page }) => {
    const member = await createStatusMember(adminToken, 'NoNotice');
    const reason = 'E2E internal only reason';
    const existingMessageIds = new Set(
      (await getMailhogMessagesForRecipient(member.email)).map((message) => message.ID),
    );

    await page.goto(`/admin/mitglieder/${member.id}`);
    await page.getByTestId('member-disable-status').getByTestId('member-status-toggle').click();
    const notify = page.getByRole('checkbox', { name: 'Mitglied per E-Mail benachrichtigen' });
    const includeReason = page.getByRole('checkbox', { name: 'Grund in E-Mail aufnehmen' });
    await expect(notify).toBeChecked();
    await page.getByTestId('member-disable-reason').fill(reason);
    await page.getByTestId('member-disable-include-reason').getByText('Grund in E-Mail aufnehmen', { exact: true }).click();
    await expect(includeReason).toBeChecked();
    await page.getByTestId('member-disable-notify').getByText('Mitglied per E-Mail benachrichtigen', { exact: true }).click();
    await expect(notify).not.toBeChecked();
    await expect(includeReason).not.toBeChecked();
    await expect(includeReason).toBeDisabled();
    await page.getByTestId('member-disable-confirm').click();

    await expectAdminNotice(member.email, reason);
    const absenceDeadline = Date.now() + 3_000;
    do {
      const newMessages = (await getMailhogMessagesForRecipient(member.email))
        .filter((message) => !existingMessageIds.has(message.ID));
      expect(newMessages).toHaveLength(0);
      if (Date.now() < absenceDeadline) await page.waitForTimeout(250);
    } while (Date.now() < absenceDeadline);
    await expect(page.getByTestId('member-disable-status')).toContainText(reason);
  });

  test('include-reason choice delivers reason and blank reason creates no empty reason block', async ({ page }) => {
    const member = await createStatusMember(adminToken, 'IncludedReason');
    const reason = 'E2E member-facing reason';

    await page.goto(`/admin/mitglieder/${member.id}`);
    await page.getByTestId('member-disable-status').getByTestId('member-status-toggle').click();
    await page.getByTestId('member-disable-reason').fill(reason);
    const includeReason = page.getByRole('checkbox', { name: 'Grund in E-Mail aufnehmen' });
    await expect(includeReason).toBeEnabled();
    await page.getByTestId('member-disable-include-reason').getByText('Grund in E-Mail aufnehmen', { exact: true }).click();
    await page.getByTestId('member-disable-confirm').click();

    const memberBody = await getMailhogBodyForSubject(member.email, memberNoticeSubject);
    expect(memberBody).toContain(reason);
    expect(memberBody).toContain('Deaktivierungsgrund:');
    await expectAdminNotice(member.email, reason);

    const blankMember = await createStatusMember(adminToken, 'BlankReason');
    await page.goto(`/admin/mitglieder/${blankMember.id}`);
    await page.getByTestId('member-disable-status').getByTestId('member-status-toggle').click();
    const blankReasonCheckbox = page.getByRole('checkbox', { name: 'Grund in E-Mail aufnehmen' });
    await expect(blankReasonCheckbox).toBeDisabled();
    await page.getByTestId('member-disable-confirm').click();
    const blankMemberBody = await getMailhogBodyForSubject(blankMember.email, memberNoticeSubject);
    expect(blankMemberBody).not.toContain('Deaktivierungsgrund:');
    expect(blankMemberBody).not.toContain('{{reason}}');
    const disabledMembers = await getMembers(adminToken, 'disabled');
    expect(disabledMembers.find((entry) => entry.id === blankMember.id)?.disableReason).toBeNull();
  });
});
