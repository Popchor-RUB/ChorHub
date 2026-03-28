import { test, expect, Page } from '@playwright/test';
import { getAdminToken, getMostRecentPastRehearsal, formatDateShort } from '../helpers/api';

// Runs in the 'admin-auth' project — storageState: e2e/.auth/admin.json

let optionText: string;

test.beforeAll(async () => {
  const token = await getAdminToken();
  const rehearsal = await getMostRecentPastRehearsal(token);
  optionText = `${formatDateShort(rehearsal.date)} – ${rehearsal.title}`;
});

async function selectPastRehearsal(page: Page) {
  await page.getByRole('button', { name: /Probe auswählen/ }).click();
  await page.getByRole('option', { name: optionText }).click();
  await expect(page.getByPlaceholder('Name filtern…')).toBeVisible();
}

async function openScanResultForMember(
  page: Page,
  memberId: string,
  memberName: string,
  opts: { assertName?: boolean } = {},
) {
  const { assertName = true } = opts;
  await page.getByTestId('attendance-open-qr-scanner').click();
  await expect(page.getByTestId('qr-scanner-modal')).toBeVisible();

  await page.evaluate(({ scannedMemberId, scannedMemberName }) => {
    const event = new CustomEvent('chorhub:e2e-qr-scan', {
      detail: {
        payload: {
          memberId: scannedMemberId,
          name: scannedMemberName,
          email: `e2e-${scannedMemberId}@chorhub.test`,
          issuedAt: new Date().toISOString(),
          version: 'v1',
        },
        signatureValid: true,
        scannedAtIso: new Date().toISOString(),
      },
    });
    window.dispatchEvent(event);
  }, { scannedMemberId: memberId, scannedMemberName: memberName });

  const resultDialog = page.getByTestId('qr-scan-result-modal');
  await expect(resultDialog).toBeVisible();
  if (assertName) {
    await expect(resultDialog.getByText(memberName)).toBeVisible();
  }
  return resultDialog;
}

test.describe('Admin QR check-in flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/anwesenheit');
    await expect(page.getByRole('heading', { name: 'Anwesenheit erfassen' })).toBeVisible();
    await selectPastRehearsal(page);
  });

  test('scan result modal toggles attendance like the table button', async ({ page }) => {
    const firstRow = page.getByTestId('attendance-member-row').first();
    const memberId = await firstRow.getAttribute('data-member-id');
    expect(memberId).toBeTruthy();

    const targetRow = page.locator(`[data-member-id="${memberId}"]`);
    const memberName = (await targetRow.locator('p').first().innerText()).trim();
    const rowButton = targetRow.locator('button').first();
    const initialLabel = (await rowButton.innerText()).trim();
    expect(['+ Erfassen', '✓ Anwesend']).toContain(initialLabel);

    const resultDialog = await openScanResultForMember(page, memberId!, memberName);
    const modalToggleButton = resultDialog.getByRole('button').filter({ hasText: /^(\+ Erfassen|✓ Anwesend)$/ }).first();

    await expect(modalToggleButton).toHaveText(initialLabel);
    await modalToggleButton.click();

    const nextLabel = initialLabel === '+ Erfassen' ? '✓ Anwesend' : '+ Erfassen';
    await expect(rowButton).toHaveText(nextLabel);
    await expect(modalToggleButton).toHaveText(nextLabel);

    await modalToggleButton.click();
    await expect(rowButton).toHaveText(initialLabel);
    await expect(modalToggleButton).toHaveText(initialLabel);
  });

  test('scan next button closes result modal and reopens scanner', async ({ page }) => {
    const targetRow = page.getByTestId('attendance-member-row').first();
    const memberId = await targetRow.getAttribute('data-member-id');
    expect(memberId).toBeTruthy();
    const memberName = (await targetRow.locator('p').first().innerText()).trim();

    const resultDialog = await openScanResultForMember(page, memberId!, memberName);
    await resultDialog.getByRole('button', { name: 'Nächsten QR-Code scannen' }).click();

    await expect(page.getByTestId('qr-scanner-modal')).toBeVisible();
    await expect(page.getByTestId('qr-scan-result-modal')).not.toBeVisible();
  });

  test('shows an error when scanned member id is invalid', async ({ page }) => {
    const invalidMemberId = 'invalid-member-id-e2e';
    const scannedName = 'Unbekanntes Mitglied';

    const resultDialog = await openScanResultForMember(page, invalidMemberId, scannedName, { assertName: false });

    await expect(
      resultDialog.getByText('Mitgliedsdaten konnten nicht geladen werden. Die Mitglieds-ID ist ungültig.'),
    ).toBeVisible();
    await expect(resultDialog.getByText(scannedName)).not.toBeVisible();
  });
});
