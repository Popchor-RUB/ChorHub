import { expect, test } from '@playwright/test';
import { mockUnexcusedAbsences, openAbsenceChecklist } from '../helpers/unexcused-absence-fixture';

test('member modal uses backend classification for totals and neutral absence rows', async ({ page }) => {
  await mockUnexcusedAbsences(page);
  const row = await openAbsenceChecklist(page);
  await expect(row.getByText('1x unentschuldigt gefehlt')).toBeVisible();
  await row.getByRole('button', { name: 'Absence Fixture' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('1 unentschuldigt gefehlt', { exact: true })).toBeVisible();
  await expect(dialog.getByText('– Fehlzeit nicht gewertet', { exact: true })).toHaveCount(2);
  await expect(dialog.getByText('✗ unentsch. gefehlt', { exact: true })).toHaveCount(1);
});

test('member detail page shares the backend absence count', async ({ page }) => {
  await mockUnexcusedAbsences(page);
  await page.goto('/admin/mitglieder/absence-member');
  await expect(page.getByText('1 unentschuldigt gefehlt', { exact: true })).toBeVisible();
  await expect(page.getByTestId('member-detail-past-row-before-joining')).toContainText('– Fehlzeit nicht gewertet');
  await expect(page.getByTestId('member-detail-past-row-unrecorded')).toContainText('– Fehlzeit nicht gewertet');
});

test('checklist refreshes backend counts after recording and removing attendance', async ({ page }) => {
  await mockUnexcusedAbsences(page);
  const row = await openAbsenceChecklist(page);
  await expect(row.getByText('1x unentschuldigt gefehlt')).toBeVisible();
  await row.getByRole('button', { name: '+ Erfassen' }).click();
  await expect(row.getByText('1x unentschuldigt gefehlt')).toHaveCount(0);
  await row.getByRole('button', { name: '✓ Anwesend' }).click();
  await expect(row.getByText('1x unentschuldigt gefehlt')).toBeVisible();
});

test('modal attendance edits reload classification and refresh checklist on close', async ({ page }) => {
  await mockUnexcusedAbsences(page);
  const row = await openAbsenceChecklist(page);
  await row.getByRole('button', { name: 'Absence Fixture' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('1 unentschuldigt gefehlt', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
  await dialog.getByText(/- Recorded rehearsal/).click();
  await expect(dialog.getByText('0 unentschuldigt gefehlt', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(row.getByText('1x unentschuldigt gefehlt')).toHaveCount(0);
});

test('checklist polls backend counts for remote changes', async ({ page }) => {
  const state = await mockUnexcusedAbsences(page);
  const row = await openAbsenceChecklist(page);
  await expect(row.getByText('1x unentschuldigt gefehlt')).toBeVisible();
  state.count = 2;
  await expect(row.getByText('2x unentschuldigt gefehlt')).toBeVisible({ timeout: 10_000 });
});

test('checklist also shows backend counts for disabled members', async ({ page }) => {
  const state = await mockUnexcusedAbsences(page);
  state.disabled = true;
  const row = await openAbsenceChecklist(page);
  await expect(row.getByText('1x unentschuldigt gefehlt')).toBeVisible();
});

test('member overview table refreshes its count after modal edits', async ({ page }) => {
  await mockUnexcusedAbsences(page);
  await page.route('**/admin/members/activity-stats', (route) => route.fulfill({ status: 503, json: {} }));
  await page.goto('/admin/mitglieder');
  const row = page.getByRole('row').filter({ hasText: 'absence@example.test' });
  await expect(row.getByRole('gridcell').last()).toHaveText('1');
  await row.click();
  const dialog = page.getByRole('dialog', { name: /Absence Fixture/ });
  await dialog.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
  await dialog.getByText(/- Recorded rehearsal/).click();
  await expect(dialog.getByText('0 unentschuldigt gefehlt', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(row.getByRole('gridcell').last()).toHaveText('0');
});
