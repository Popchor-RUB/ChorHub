import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

type MockJob = {
  id: string;
  kind: 'BULK' | 'TEST';
  status: 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | 'UNKNOWN';
  createdAt: string;
  sentAt: string | null;
  rawSubject: string;
  subject: string;
  markdownContent: string;
  signatureMarkdown: string;
  attachments: { id: string; filename: string; contentType: string; size: number }[];
  failureCode: string | null;
  retryJobId: string | null;
  idempotencyKey: string | null;
};

function makeJob(id: string, subject: string, key: string): MockJob {
  return {
    id,
    kind: 'BULK',
    status: 'PENDING',
    createdAt: '2026-10-01T10:00:00.000Z',
    sentAt: null,
    rawSubject: subject,
    subject,
    markdownContent: 'Recovered E2E message',
    signatureMarkdown: 'E2E signature',
    attachments: [],
    failureCode: null,
    retryJobId: null,
    idempotencyKey: key,
  };
}

async function fillComposer(page: Page, subject: string) {
  await page.getByTestId('admin-email-subject').fill(subject);
  await page.getByTestId('admin-email-body-desktop').fill('Recoverable body content.');
  await page.getByTestId('admin-email-signature-desktop').fill('Recoverable signature.');
}

test.describe('Admin email uncertain submission recovery', () => {
  test('retries uncertain response with same key and locks composer after acceptance', async ({ page }) => {
    let jobs: MockJob[] = [];
    const keys: string[] = [];
    await page.route('**/admin/emails/jobs**', (route) => {
      if (route.request().method() === 'GET') return route.fulfill({ json: jobs });
      return route.continue();
    });
    await page.route('**/admin/emails', async (route) => {
      if (route.request().method() === 'GET') return route.fulfill({ json: [] });
      if (route.request().method() !== 'POST') return route.continue();
      const key = route.request().headers()['idempotency-key'] ?? '';
      keys.push(key);
      if (keys.length === 1) return route.fulfill({ status: 504, json: { message: 'upstream timeout' } });
      const accepted = makeJob('recovered-email-job', 'Lost response E2E', key);
      jobs = [accepted];
      return route.fulfill({
        status: 202,
        json: { id: accepted.id, kind: accepted.kind, status: accepted.status, createdAt: accepted.createdAt },
      });
    });

    await page.goto('/admin/informationen/email');
    await fillComposer(page, 'Lost response E2E');
    const send = page.getByTestId('admin-email-send');
    await send.click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByTestId('admin-email-subject')).toHaveValue('Lost response E2E');
    await expect(page.getByTestId('admin-email-body-desktop')).toHaveValue('Recoverable body content.');
    await expect(send).toBeEnabled();

    await send.click();
    await expect.poll(() => keys.length).toBe(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
    await expect(send).toBeDisabled();
  });

  test('changed payload after uncertain response receives a fresh idempotency key', async ({ page }) => {
    let jobs: MockJob[] = [];
    const keys: string[] = [];
    await page.route('**/admin/emails/jobs**', (route) => {
      if (route.request().method() === 'GET') return route.fulfill({ json: jobs });
      return route.continue();
    });
    await page.route('**/admin/emails', async (route) => {
      if (route.request().method() === 'GET') return route.fulfill({ json: [] });
      if (route.request().method() !== 'POST') return route.continue();
      const key = route.request().headers()['idempotency-key'] ?? '';
      keys.push(key);
      if (keys.length === 1) return route.fulfill({ status: 504, json: { message: 'upstream timeout' } });
      const accepted = makeJob('changed-email-job', 'Changed payload E2E', key);
      jobs = [accepted];
      return route.fulfill({
        status: 202,
        json: { id: accepted.id, kind: accepted.kind, status: accepted.status, createdAt: accepted.createdAt },
      });
    });

    await page.goto('/admin/informationen/email');
    await fillComposer(page, 'Original uncertain E2E');
    await page.getByTestId('admin-email-send').click();
    await expect(page.getByRole('alert')).toBeVisible();
    await page.getByTestId('admin-email-subject').fill('Changed payload E2E');
    await page.getByTestId('admin-email-send').click();
    await expect.poll(() => keys.length).toBe(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBeTruthy();
    expect(keys[1]).not.toBe(keys[0]);
  });
});
