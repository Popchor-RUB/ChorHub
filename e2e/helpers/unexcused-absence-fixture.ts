import type { Page } from '@playwright/test';

export async function mockUnexcusedAbsences(page: Page) {
  const state = { attended: false, plan: null as 'CONFIRMED' | 'DECLINED' | null, count: 1, disabled: false };
  const member = {
    id: 'absence-member', firstName: 'Absence', lastName: 'Fixture',
    email: 'absence@example.test', choirVoice: null,
    createdAt: '2026-06-01T12:00:00Z', isDisabled: false,
    disabledAt: null, disableReason: null, internalComment: null, voiceAdminVoices: [],
  };
  const rehearsal = {
    id: 'recorded', date: '2026-06-02T18:00:00Z', title: 'Recorded rehearsal',
    isOptional: false, description: null, location: null, durationMinutes: 120,
  };

  await page.clock.setFixedTime(new Date('2026-06-10T12:00:00Z'));
  await page.addInitScript(() => {
    localStorage.setItem('chorhub-auth', JSON.stringify({
      state: { adminSession: { token: 'fixture', username: 'admin' }, memberSession: null }, version: 0,
    }));
    localStorage.setItem('i18nextLng', 'de');
  });
  await page.route('**/choir-voices', (route) => route.fulfill({ json: [] }));
  await page.route('**/admin/members*', (route) => {
    const disabled = new URL(route.request().url()).searchParams.get('status') === 'disabled';
    return route.fulfill({
      json: state.disabled === disabled
        ? [{ ...member, isDisabled: state.disabled, attendanceCount: state.attended ? 1 : 0, unexcusedAbsenceCount: state.count }]
        : [],
    });
  });
  await page.route('**/admin/members/absence-member', (route) => route.fulfill({
    json: { ...member, attendanceCount: state.attended ? 1 : 0, unexcusedAbsenceCount: state.count },
  }));
  await page.route('**/admin/members/absence-member/rehearsals', (route) => route.fulfill({
    json: [
      { ...rehearsal, id: 'before-joining', date: '2026-05-31T18:00:00Z', title: 'Before joining', attended: false, plan: null, isUnexcusedAbsence: false },
      { ...rehearsal, id: 'unrecorded', date: '2026-06-01T18:00:00Z', title: 'Unrecorded rehearsal', attended: false, plan: null, isUnexcusedAbsence: false },
      { ...rehearsal, attended: state.attended, plan: state.plan, isUnexcusedAbsence: state.count > 0 },
    ],
  }));
  await page.route('**/rehearsals/all', (route) => route.fulfill({ json: [rehearsal] }));
  await page.route('**/attendance/records/recorded', async (route) => {
    if (route.request().method() === 'PUT') {
      const body: { attended: boolean } = route.request().postDataJSON();
      state.attended = body.attended;
      state.count = body.attended ? 0 : 1;
      return route.fulfill({ json: {} });
    }
    return route.fulfill({ json: [{
      ...member, attended: state.attended, plan: state.plan, lastAttendedRehearsalsAgo: null,
    }] });
  });
  await page.route('**/admin/members/absence-member/attendance-plans/recorded', async (route) => {
    const body: { response: typeof state.plan } = route.request().postDataJSON();
    state.plan = body.response;
    return route.fulfill({ json: {} });
  });
  return state;
}

export async function openAbsenceChecklist(page: Page) {
  await page.goto('/admin/anwesenheit');
  await page.getByRole('button', { name: /Probe auswählen/ }).click();
  await page.getByRole('option', { name: /Recorded rehearsal/ }).click();
  return page.getByTestId('attendance-member-row').filter({ hasText: 'Absence Fixture' });
}
