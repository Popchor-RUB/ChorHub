import { expect, test } from '@playwright/test';

type JobStatus = 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | 'UNKNOWN';

interface JobDto {
  id: string;
  kind: 'BULK' | 'TEST';
  status: JobStatus;
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
}

function job(id: string, subject: string, status: JobStatus): JobDto {
  return {
    id,
    kind: 'BULK',
    status,
    createdAt: '2026-10-01T10:00:00.000Z',
    sentAt: status === 'SENT' ? '2026-10-01T10:00:02.000Z' : null,
    rawSubject: subject,
    subject,
    markdownContent: 'E2E job body',
    signatureMarkdown: 'E2E signature',
    attachments: [],
    failureCode: status === 'FAILED' ? 'SMTP_REJECTED' : null,
    retryJobId: null,
    idempotencyKey: null,
  };
}

async function mockEmailPage(page: import('@playwright/test').Page) {
  await page.route('**/admin/emails', (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: [] });
    return route.continue();
  });
}

test.describe('Admin email job status', () => {
  test('reload recovers pending status and transient polling error preserves it', async ({ page }) => {
    let failNextPoll = false;
    let failedPollSeen = false;
    let currentStatus: JobStatus = 'PENDING';
    const pending = job('job-pending-ui', 'Pending UI E2E', 'PENDING');
    await mockEmailPage(page);
    await page.route('**/admin/emails/jobs**', (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      if (failNextPoll) {
        failNextPoll = false;
        failedPollSeen = true;
        return route.fulfill({ status: 503, body: 'temporary failure' });
      }
      return route.fulfill({ json: [job(pending.id, pending.rawSubject, currentStatus)] });
    });

    await page.goto('/admin/informationen/email');
    const list = page.getByTestId('admin-email-jobs');
    const pendingStatus = list.locator('[data-testid="admin-email-job-status"][data-status="PENDING"]');
    await expect(pendingStatus).toBeVisible();
    await page.reload();
    await expect(list.locator('[data-testid="admin-email-job-status"][data-status="PENDING"]')).toBeVisible();
    failNextPoll = true;
    await expect.poll(() => failedPollSeen, { timeout: 6_000 }).toBe(true);
    await expect(list.locator('[data-testid="admin-email-job-status"][data-status="PENDING"]')).toBeVisible();
    await expect(list).toContainText('Auftragsstatus konnte nicht aktualisiert werden. Angezeigter Status bleibt erhalten.');
    currentStatus = 'SENT';
    await expect(list.locator('[data-testid="admin-email-job-status"][data-status="SENT"]')).toBeVisible({ timeout: 8_000 });
  });

  test('unknown retry waits for duplicate-risk confirmation and sends fresh idempotency key', async ({ page }) => {
    const unknown = job('job-unknown-ui', 'Uncertain E2E', 'UNKNOWN');
    const failed = job('job-failed-ui', 'Failed E2E', 'FAILED');
    const retry = job('job-retry-ui', 'Uncertain E2E', 'PENDING');
    let retryRequest: { key: string | null; body: unknown } | undefined;
    await mockEmailPage(page);
    await page.route('**/admin/emails/jobs**', async (route) => {
      const request = route.request();
      if (request.method() === 'GET') return route.fulfill({ json: [unknown, failed] });
      if (request.method() === 'POST' && request.url().endsWith('/job-unknown-ui/retry')) {
        retryRequest = {
          key: request.headers()['idempotency-key'] ?? null,
          body: request.postDataJSON(),
        };
        return route.fulfill({ status: 202, json: retry });
      }
      return route.continue();
    });

    await page.goto('/admin/informationen/email');
    const unknownRow = page.getByTestId('admin-email-jobs').locator('details').filter({ hasText: 'Uncertain E2E' });
    await unknownRow.locator('summary').click();
    await unknownRow.getByTestId('admin-email-job-retry').click();
    await expect(page.getByTestId('admin-email-job-confirm-retry')).toBeVisible();
    expect(retryRequest).toBeUndefined();
    await page.getByTestId('admin-email-job-confirm-retry').click();

    await expect.poll(() => retryRequest).toBeDefined();
    expect(retryRequest?.key).toBeTruthy();
    expect(retryRequest?.body).toMatchObject({ acknowledgeDuplicateRisk: true });
  });

  test('failed job retry needs no duplicate-risk acknowledgement', async ({ page }) => {
    const failed = job('job-failed-retry-ui', 'Failed retry E2E', 'FAILED');
    const retry = job('job-failed-retry-new', 'Failed retry E2E', 'PENDING');
    let retryRequest: { key: string | null; body: unknown } | undefined;
    await mockEmailPage(page);
    await page.route('**/admin/emails/jobs**', async (route) => {
      const request = route.request();
      if (request.method() === 'GET') return route.fulfill({ json: [failed] });
      if (request.method() === 'POST' && request.url().endsWith('/job-failed-retry-ui/retry')) {
        retryRequest = {
          key: request.headers()['idempotency-key'] ?? null,
          body: request.postDataJSON(),
        };
        return route.fulfill({ status: 202, json: retry });
      }
      return route.continue();
    });

    await page.goto('/admin/informationen/email');
    const failedRow = page.getByTestId('admin-email-jobs').locator('details').filter({ hasText: 'Failed retry E2E' });
    await failedRow.locator('summary').click();
    await failedRow.getByTestId('admin-email-job-retry').click();
    await expect.poll(() => retryRequest).toBeDefined();
    expect(retryRequest?.key).toBeTruthy();
    expect(retryRequest?.body).toMatchObject({ acknowledgeDuplicateRisk: false });
  });
});
