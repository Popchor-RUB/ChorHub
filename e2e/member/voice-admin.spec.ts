import * as fs from 'fs';
import { expect, test, type Page } from '@playwright/test';
import { authStatePaths, backendUrl, e2eConfig } from '../config';
import { formatDateShort, getAdminToken, getAllRehearsals } from '../helpers/api';

type Voice = { id: string; name: string; memberCount: number };
type Member = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  choirVoice: { id: string; name: string } | null;
  voiceAdminVoices?: { id: string; name: string }[];
};
type MemberSession = { memberId: string; token: string };
type MemberRehearsal = {
  id: string;
  date: string;
  isOptional: boolean;
  attended: boolean;
  plan: 'CONFIRMED' | 'DECLINED' | null;
};

test.describe.configure({ mode: 'serial' });

test.describe('Choir voice admin attendance', () => {
  let adminToken: string;
  let memberSession: MemberSession;
  let assignedVoices: Voice[];
  let outsideMember: Member;
  let originalGrantIds: string[];
  let rehearsalId: string;
  let rehearsalOption: string;

  const adminHeaders = () => ({
    Authorization: `Bearer ${adminToken}`,
    'Content-Type': 'application/json',
  });
  const memberHeaders = () => ({
    'X-Member-Token': memberSession.token,
    'Content-Type': 'application/json',
  });

  const replaceGrants = async (voiceIds: string[]) => {
    const response = await fetch(backendUrl(`/admin/members/${memberSession.memberId}/voice-admin-voices`), {
      method: 'PUT',
      headers: adminHeaders(),
      body: JSON.stringify({ voiceIds }),
    });
    expect(response.ok, await response.text()).toBeTruthy();
  };

  const openAttendance = async (page: Page) => {
    await page.goto('/anwesenheit');
    await expect(page.getByRole('heading', { name: 'Anwesenheit erfassen' })).toBeVisible();
    await page.getByRole('button', { name: /Probe auswählen/ }).click();
    await page.getByRole('option', { name: rehearsalOption }).click();
    await expect(page.getByPlaceholder('Name filtern…')).toBeVisible();
  };

  const scan = async (page: Page, memberId: string, name: string, signatureValid: boolean) => {
    await page.getByTestId('attendance-open-qr-scanner').click();
    await expect(page.getByTestId('qr-scanner-modal')).toBeVisible();
    await page.evaluate(({ memberId: id, name: payloadName, signatureValid: valid }) => {
      window.dispatchEvent(new CustomEvent('chorhub:e2e-qr-scan', {
        detail: {
          payload: {
            memberId: id,
            name: payloadName,
            issuedAt: new Date().toISOString(),
            version: 'v1',
          },
          signatureValid: valid,
          scannedAtIso: new Date().toISOString(),
        },
      }));
    }, { memberId, name, signatureValid });
    const dialog = page.getByTestId('qr-scan-result-modal');
    await expect(dialog).toBeVisible();
    return dialog;
  };

  test.beforeAll(async () => {
    adminToken = await getAdminToken();
    const saved = JSON.parse(fs.readFileSync(authStatePaths.member, 'utf-8')) as {
      origins: { localStorage: { name: string; value: string }[] }[];
    };
    const authEntry = saved.origins.flatMap((origin) => origin.localStorage)
      .find((entry) => entry.name === 'chorhub-auth');
    if (!authEntry) throw new Error('Member auth state missing');
    memberSession = (JSON.parse(authEntry.value) as { state: { memberSession: MemberSession } })
      .state.memberSession;

    const [voicesResponse, membersResponse, detailResponse, rehearsals] = await Promise.all([
      fetch(backendUrl('/choir-voices')),
      fetch(backendUrl('/admin/members'), { headers: adminHeaders() }),
      fetch(backendUrl(`/admin/members/${memberSession.memberId}`), { headers: adminHeaders() }),
      getAllRehearsals(adminToken),
    ]);
    expect(voicesResponse.ok).toBeTruthy();
    expect(membersResponse.ok).toBeTruthy();
    expect(detailResponse.ok).toBeTruthy();
    const voices = (await voicesResponse.json()) as Voice[];
    const members = (await membersResponse.json()) as Member[];
    const detail = (await detailResponse.json()) as Member;
    const populatedVoices = voices.filter((voice) => voice.memberCount > 0);
    if (populatedVoices.length < 3) throw new Error('Need three populated voices');
    assignedVoices = populatedVoices.slice(0, 2);
    const outsideVoiceMember = members.find((member) => member.choirVoice?.id === populatedVoices[2].id);
    if (!outsideVoiceMember) throw new Error('Outside-voice member missing');
    outsideMember = outsideVoiceMember;
    originalGrantIds = detail.voiceAdminVoices?.map((voice) => voice.id) ?? [];

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const rehearsal = rehearsals.find((item) => !('isOptional' in item && item.isOptional)
      && new Date(item.date) < startOfToday);
    if (!rehearsal) throw new Error('Need past nonoptional rehearsal');
    rehearsalId = rehearsal.id;
    rehearsalOption = `${formatDateShort(rehearsal.date)} – ${rehearsal.title}`;

    await replaceGrants([]);
  });

  test.afterAll(async () => {
    if (adminToken && memberSession && originalGrantIds) {
      await replaceGrants(originalGrantIds);
    }
  });

  test('admin assigns two voices; member sees scoped attendance on desktop and mobile', async ({ browser, page }) => {
    const adminContext = await browser.newContext({
      storageState: authStatePaths.admin,
      ignoreHTTPSErrors: true,
      locale: 'de-DE',
    });
    try {
      const adminPage = await adminContext.newPage();
      await adminPage.goto(`${e2eConfig.baseUrl}/admin/mitglieder/${memberSession.memberId}`);
      const grants = adminPage.getByTestId('voice-admin-grants');
      await expect(grants).toBeVisible();
      for (const voice of assignedVoices) {
        await grants.getByText(voice.name, { exact: true }).click();
        await expect(grants.getByRole('checkbox', { name: voice.name, exact: true })).toBeChecked();
      }
      await adminPage.getByTestId('voice-admin-grants-save').click();
      await expect.poll(async () => {
        const response = await fetch(backendUrl(`/admin/members/${memberSession.memberId}`), {
          headers: adminHeaders(),
        });
        const member = (await response.json()) as Member;
        return member.voiceAdminVoices?.map((voice) => voice.id).sort();
      }).toEqual(assignedVoices.map((voice) => voice.id).sort());
    } finally {
      await adminContext.close();
    }

    await openAttendance(page);
    await expect(page.locator('[data-testid="voice-admin-nav"]:visible')).toBeVisible();
    const assignedMembers = (await fetch(backendUrl('/admin/members'), {
      headers: adminHeaders(),
    }).then((response) => response.json()) as Member[])
      .filter((member) => assignedVoices.some((voice) => voice.id === member.choirVoice?.id));
    const allowedMemberIds = new Set(assignedMembers.map((member) => member.id));
    const rows = page.getByTestId('attendance-member-row');
    expect(await rows.count()).toBeGreaterThan(0);
    for (const row of await rows.all()) {
      expect(allowedMemberIds.has((await row.getAttribute('data-member-id')) ?? '')).toBeTruthy();
    }
    await expect(page.locator(`[data-member-id="${outsideMember.id}"]`)).toHaveCount(0);

    for (const voice of assignedVoices) {
      const chip = page.getByRole('button', { name: voice.name, exact: true });
      await expect(chip).toBeVisible();
      const escapedName = voice.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const section = page.getByRole('button', {
        name: new RegExp(`^[▸▾]\\s*${escapedName} \\(\\d+\\)`),
      }).locator('..');
      await expect(section).toBeVisible();
      const sectionIds = await section.getByTestId('attendance-member-row').evaluateAll((elements) =>
        elements.map((element) => element.getAttribute('data-member-id')));
      const membersById = new Map(assignedMembers.map((member) => [member.id, member]));
      const sortedIds = [...sectionIds].sort((firstId, secondId) => {
        const first = membersById.get(firstId ?? '');
        const second = membersById.get(secondId ?? '');
        if (!first || !second) return 0;
        return first.firstName.localeCompare(second.firstName, 'de')
          || first.lastName.localeCompare(second.lastName, 'de');
      });
      expect(sectionIds).toEqual(sortedIds);
      await chip.click();
      await expect(rows).toHaveCount(sectionIds.length);
      await page.getByRole('button', { name: 'Alle', exact: true }).click();
    }

    const recordsResponse = await fetch(backendUrl(`/attendance/voice-admin/records/${rehearsalId}`), {
      headers: memberHeaders(),
    });
    expect(recordsResponse.ok).toBeTruthy();
    const records = (await recordsResponse.json()) as Record<string, unknown>[];
    expect(records.every((record) => !('email' in record))).toBeTruthy();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('[data-testid="voice-admin-nav"]:visible')).toBeVisible();
  });

  test('member detail edits plan through scoped API', async ({ page }) => {
    await openAttendance(page);
    const firstRow = page.getByTestId('attendance-member-row').first();
    const memberId = await firstRow.getAttribute('data-member-id');
    if (!memberId) throw new Error('Scoped member row missing ID');
    const response = await fetch(backendUrl(`/attendance/voice-admin/members/${memberId}/rehearsals`), {
      headers: memberHeaders(),
    });
    expect(response.ok).toBeTruthy();
    const rehearsals = (await response.json()) as MemberRehearsal[];
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const upcoming = rehearsals.find((item) => new Date(item.date) >= startOfToday);
    if (!upcoming) {
      test.skip(true, 'No upcoming rehearsal');
      return;
    }

    await firstRow.locator('button').first().click();
    const modal = page.getByTestId('voice-admin-member-detail');
    await expect(modal).toBeVisible();
    await modal.getByTestId('voice-admin-member-edit-mode-toggle').click();
    try {
      await modal.getByTestId(`voice-admin-member-upcoming-row-${upcoming.id}`).click();
      await expect.poll(async () => {
        const current = await fetch(backendUrl(`/attendance/voice-admin/members/${memberId}/rehearsals`), {
          headers: memberHeaders(),
        }).then((result) => result.json()) as MemberRehearsal[];
        return current.find((item) => item.id === upcoming.id)?.plan;
      }).not.toBe(upcoming.plan);
    } finally {
      await fetch(backendUrl(`/attendance/voice-admin/members/${memberId}/attendance-plans/${upcoming.id}`), {
        method: 'PUT',
        headers: memberHeaders(),
        body: JSON.stringify({ response: upcoming.plan }),
      });
    }
  });

  test('QR scan shows scoped server name; rejects invalid and outside scans', async ({ page }) => {
    await openAttendance(page);
    const firstRow = page.getByTestId('attendance-member-row').first();
    const memberId = await firstRow.getAttribute('data-member-id');
    if (!memberId) throw new Error('Scoped member row missing ID');
    const memberName = (await firstRow.locator('button').first().innerText()).trim();
    const initialButton = firstRow.getByRole('button', { name: /Erfassen|Anwesend/ });
    const initialLabel = (await initialButton.innerText()).trim();

    const validDialog = await scan(page, memberId, 'Spoofed QR Name', true);
    await expect(validDialog.getByText(memberName)).toBeVisible();
    await expect(validDialog.getByText('Spoofed QR Name')).toHaveCount(0);
    await expect(validDialog.getByText('@', { exact: false })).toHaveCount(0);
    await validDialog.getByRole('button', { name: /Erfassen|Anwesend/ }).click();
    await expect(initialButton).not.toHaveText(initialLabel);
    await validDialog.getByRole('button', { name: 'Schließen' }).click();
    await firstRow.getByRole('button', { name: /Erfassen|Anwesend/ }).click();
    await expect(firstRow.getByRole('button', { name: /Erfassen|Anwesend/ })).toHaveText(initialLabel);

    const invalidDialog = await scan(page, memberId, memberName, false);
    await expect(invalidDialog.getByRole('button', { name: /Erfassen|Anwesend/ })).toBeDisabled();
    await invalidDialog.getByRole('button', { name: 'Schließen' }).click();

    const outsideName = `${outsideMember.firstName} ${outsideMember.lastName}`;
    const outsideDialog = await scan(page, outsideMember.id, outsideName, true);
    await expect(outsideDialog.getByText(outsideName)).toHaveCount(0);
    await expect(outsideDialog.getByText(outsideMember.email)).toHaveCount(0);
    await expect(outsideDialog.getByRole('button', { name: /Erfassen|Anwesend/ })).toBeDisabled();
  });

  test('revocation removes attendance access', async ({ page }) => {
    await replaceGrants([]);
    await page.goto('/anwesenheit');
    await expect(page.locator('[data-testid="voice-admin-nav"]:visible')).toHaveCount(0);
    await expect(page.getByTestId('attendance-member-row')).toHaveCount(0);
    const response = await fetch(backendUrl(`/attendance/voice-admin/records/${rehearsalId}`), {
      headers: memberHeaders(),
    });
    expect(response.status).toBe(403);
  });
});
