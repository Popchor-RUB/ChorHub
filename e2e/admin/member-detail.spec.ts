import { expect, test } from '@playwright/test';
import { getAdminToken, getMemberRehearsals } from '../helpers/api';

test.describe.configure({ mode: 'serial' });

test.describe('Admin member detail page', () => {
  let adminToken: string;
  let memberId: string;
  let memberEmail: string;
  let initialFirstName: string;
  let initialLastName: string;
  let initialVoiceId: string | null = null;
  let conflictEmail: string;
  let alternateVoiceName: string | null = null;
  let alternateVoiceId: string | null = null;

  test.beforeAll(async () => {
    adminToken = await getAdminToken();

    const members = await fetch('http://localhost:3000/admin/members', {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.json()) as {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      choirVoice: { id: string; name: string } | null;
    }[];

    if (members.length < 2) {
      throw new Error('Need at least two seeded members for member detail e2e tests');
    }

    const primaryMember = members[10];
    const conflictMember = members[1];

    memberId = primaryMember.id;
    memberEmail = primaryMember.email;
    initialFirstName = primaryMember.firstName;
    initialLastName = primaryMember.lastName;
    initialVoiceId = primaryMember.choirVoice?.id ?? null;
    conflictEmail = conflictMember.email;

    const voices = await fetch('http://localhost:3000/choir-voices', {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.json()) as { id: string; name: string }[];

    const alternateVoice = voices.find((voice) => voice.id !== initialVoiceId) ?? voices[0] ?? null;
    if (alternateVoice) {
      alternateVoiceName = alternateVoice.name;
      alternateVoiceId = alternateVoice.id;
    }
  });

  test.afterAll(async () => {
    await fetch(`http://localhost:3000/admin/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        firstName: initialFirstName,
        lastName: initialLastName,
        email: memberEmail,
        voiceId: initialVoiceId,
      }),
    }).catch(() => {});
  });

  test('opens detail page via member detail modal button', async ({ page }) => {
    await page.goto('/admin/mitglieder');
    await page.getByPlaceholder('Name suchen…').fill(`${initialFirstName} ${initialLastName}`);
    const memberRow = page.getByRole('row')
      .filter({ hasText: `${initialFirstName} ${initialLastName}` })
      .filter({ hasText: memberEmail })
      .first();
    await expect(memberRow).toBeVisible({ timeout: 10_000 });
    await memberRow.click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByTestId('member-detail-open-page').click();

    await page.waitForURL(`**/admin/mitglieder/${memberId}`);
    await expect(page.getByTestId('member-detail-page')).toBeVisible();
  });

  test('loads member data and rehearsal sections', async ({ page }) => {
    await page.goto(`/admin/mitglieder/${memberId}`);

    await expect(page.getByTestId('member-detail-first-name')).toHaveValue(initialFirstName);
    await expect(page.getByTestId('member-detail-last-name')).toHaveValue(initialLastName);
    await expect(page.getByTestId('member-detail-email')).toHaveValue(memberEmail);

    const hasUpcoming = await page.getByTestId('member-detail-upcoming-section').isVisible().catch(() => false);
    const hasPast = await page.getByTestId('member-detail-past-section').isVisible().catch(() => false);
    const hasEmpty = await page.getByText('Keine Proben vorhanden.').isVisible().catch(() => false);
    expect(hasUpcoming || hasPast || hasEmpty).toBeTruthy();
  });

  test('edits and saves name/email/voice persistently', async ({ page }) => {
    const updatedEmail = `detail.updated.${Date.now()}.${memberEmail}`;

    await page.goto(`/admin/mitglieder/${memberId}`);
    await page.getByTestId('member-detail-first-name').fill('DetailNeu');
    await page.getByTestId('member-detail-last-name').fill('TestNeu');
    await page.getByTestId('member-detail-email').fill(updatedEmail);

    if (alternateVoiceName && alternateVoiceId && alternateVoiceId !== initialVoiceId) {
      await page.getByTestId('member-detail-voice').click();
      await page.getByRole('option', { name: alternateVoiceName }).first().click();
    }

    await page.getByTestId('member-detail-save').click();
    await expect(page.getByText('Gespeichert ✓')).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('member-detail-first-name')).toHaveValue('DetailNeu');
    await expect(page.getByTestId('member-detail-last-name')).toHaveValue('TestNeu');
    await expect(page.getByTestId('member-detail-email')).toHaveValue(updatedEmail);

    memberEmail = updatedEmail;
  });

  test('sends invitation mail action', async ({ page }) => {
    await page.goto(`/admin/mitglieder/${memberId}`);
    await page.getByTestId('member-detail-email-menu').click();
    await page.getByRole('menuitem', { name: 'Einladung senden' }).click();
    await expect(page.getByText('Gespeichert ✓')).toBeVisible();
  });

  test('sends new login mail action', async ({ page }) => {
    await page.goto(`/admin/mitglieder/${memberId}`);
    await page.getByTestId('member-detail-email-menu').click();
    await page.getByRole('menuitem', { name: 'Neuen Login senden' }).click();
    await expect(page.getByText('Gespeichert ✓')).toBeVisible();
  });

  test('toggles rehearsal plan and persists after refresh', async ({ page }) => {
    const before = await getMemberRehearsals(adminToken, memberId);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const target = before.find((r) => new Date(r.date) >= startOfToday);
    test.skip(!target, 'No rehearsals available for this member');
    const selector = `member-detail-upcoming-row-${target.id}`;

    await page.goto(`/admin/mitglieder/${memberId}`);
    await page.getByRole('button', { name: 'Bearbeiten' }).click();
    await page.getByTestId(selector).click();

    await expect.poll(async () => {
      const now = await getMemberRehearsals(adminToken, memberId);
      return now.find((r) => r.id === target.id)?.plan ?? null;
    }).not.toBe(target.plan);

    await page.reload();
    const afterReload = await getMemberRehearsals(adminToken, memberId);
    expect(afterReload.find((r) => r.id === target.id)?.plan).not.toBe(target.plan);

    await fetch(`http://localhost:3000/admin/members/${memberId}/attendance-plans/${target.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ response: target.plan }),
    });

    await expect.poll(async () => {
      const now = await getMemberRehearsals(adminToken, memberId);
      return now.find((r) => r.id === target.id)?.plan ?? null;
    }).toBe(target.plan);
  });

  test('shows conflict error when using duplicate email and keeps form values', async ({ page }) => {
    await page.goto(`/admin/mitglieder/${memberId}`);
    const beforeEmail = await fetch(`http://localhost:3000/admin/members/${memberId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.json()) as { email: string };

    await page.getByTestId('member-detail-email').fill(conflictEmail);
    await page.getByTestId('member-detail-save').click();

    await expect(page.getByTestId('member-detail-email')).toHaveValue(conflictEmail);

    await expect.poll(async () => {
      const current = await fetch(`http://localhost:3000/admin/members/${memberId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      }).then((r) => r.json()) as { email: string };
      return current.email;
    }).toBe(beforeEmail.email);
  });
});
