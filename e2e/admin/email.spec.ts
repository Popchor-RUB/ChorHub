import { expect, test } from '@playwright/test';
import { backendUrl, e2eConfig, authStatePaths, smtpFixtureUrl } from '../config';
import { getAdminToken, getFirstMember } from '../helpers/api';
import {
  getMailhogBodyForSubject,
  getMailhogMessages,
  waitForMailhogMessages,
} from '../helpers/mailhog';

interface SentEmailSummary {
  id: string;
  subject: string;
  rawSubject: string;
  markdownContent: string;
  signatureMarkdown: string;
  sentAt: string;
  attachments: { id: string; filename: string; contentType: string; size: number }[];
}

interface EmailJob {
  id: string;
  kind: 'BULK' | 'TEST';
  status: 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | 'UNKNOWN';
  createdAt: string;
}

async function readJob(adminToken: string, id: string): Promise<EmailJob> {
  const response = await fetch(backendUrl(`/admin/emails/jobs/${id}`), {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (!response.ok) throw new Error(`Failed to fetch email job ${id}: ${response.status}`);
  return response.json() as Promise<EmailJob>;
}

async function waitForJobStatus(
  adminToken: string,
  id: string,
  statuses: EmailJob['status'][],
  timeoutMs = 60_000,
): Promise<EmailJob> {
  const deadline = Date.now() + timeoutMs;
  let job = await readJob(adminToken, id);
  while (Date.now() < deadline && !statuses.includes(job.status)) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    job = await readJob(adminToken, id);
  }
  expect(statuses, `Job ${id} ended in ${job.status}`).toContain(job.status);
  return job;
}

async function armSmtpControl(subjectMarker: string, action: 'hold' | 'reject') {
  const response = await fetch(smtpFixtureUrl('/controls'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subjectMarker, action }),
  });
  if (!response.ok) throw new Error(`SMTP fixture control failed: ${response.status}`);
  return response.json() as Promise<{ id: string; state: string }>;
}

async function smtpControlState(id: string): Promise<string> {
  const response = await fetch(smtpFixtureUrl(`/controls/${id}`));
  if (!response.ok) throw new Error(`SMTP fixture status failed: ${response.status}`);
  return (await response.json() as { state: string }).state;
}

async function waitForSmtpControl(id: string, expected: string, timeoutMs = 15_000) {
  await expect.poll(() => smtpControlState(id), { timeout: timeoutMs }).toBe(expected);
}

test.describe('Admin email composer and member archive', () => {
  test.describe.configure({ timeout: 90_000 });
  test('sends one email, archives it read-only, and shows it to members', async ({ page, browser }) => {
    const adminToken = await getAdminToken();
    const member = await getFirstMember(adminToken);
    const subject = `E2E Rundmail ${e2eConfig.runId} ${Date.now()}`;
    const markdownContent = '# Hallo Mitglieder\n\nDies ist der **Testinhalt** der Rundmail.';
    const signatureMarkdown = 'Viele Grüße,\n\n**Der Vorstand**';
    const attachmentFilename = 'rundmail-anhang.txt';
    const attachmentBuffer = Buffer.alloc(5 * 1024 * 1024 - 1024, 0x43);
    let sendRequests = 0;

    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        new URL(request.url()).pathname.endsWith('/admin/emails')
      ) {
        sendRequests += 1;
      }
    });

    await page.goto('/admin/informationen/email');
    const composer = page.getByTestId('admin-email-composer');
    await expect(composer).toBeVisible();
    await expect(page.getByTestId('admin-email-template-hint')).toContainText('Mail-Vorlage');

    await page.getByTestId('admin-email-subject').fill(subject);
    await page.getByTestId('admin-email-body-desktop').fill(markdownContent);
    await page.getByTestId('admin-email-signature-desktop').fill(signatureMarkdown);
    await page.getByTestId('admin-email-attachments').setInputFiles({
      name: attachmentFilename,
      mimeType: 'text/plain',
      buffer: attachmentBuffer,
    });
    await expect(composer.getByText(attachmentFilename)).toBeVisible();

    const sendResponsePromise = page.waitForResponse((response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname.endsWith('/admin/emails'),
    );
    await page.getByTestId('admin-email-send').click();
    const sendResponse = await sendResponsePromise;
    const sendResponseBody = await sendResponse.text();
    expect(
      sendResponse.status(),
      `POST /admin/emails returned ${sendResponse.status()}: ${sendResponseBody}`,
    ).toBe(202);
    const accepted = JSON.parse(sendResponseBody) as EmailJob;
    expect(accepted).toMatchObject({ kind: 'BULK', status: 'PENDING' });
    expect(accepted.id).toBeTruthy();
    await waitForJobStatus(adminToken, accepted.id, ['SENT'], 60_000);
    expect(sendRequests).toBe(1);

    const historyResponse = await fetch(backendUrl('/admin/emails'), {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(historyResponse.ok).toBeTruthy();
    const history = await historyResponse.json() as SentEmailSummary[];
    const matches = history.filter((email) => email.rawSubject === subject);
    expect(accepted.id).toBeTruthy();
    expect(
      matches,
      `History subjects: ${JSON.stringify(history.map((email) => ({ subject: email.subject, rawSubject: email.rawSubject })))}`,
    ).toHaveLength(1);

    const sentEmail = matches[0];
    expect(sentEmail.subject).toBe(subject);
    expect(sentEmail.markdownContent.replace(/\r\n/g, '\n')).toBe(markdownContent);
    expect(sentEmail.signatureMarkdown.replace(/\r\n/g, '\n')).toBe(signatureMarkdown);
    expect(sentEmail.attachments).toEqual([
      expect.objectContaining({ filename: attachmentFilename, contentType: 'text/plain' }),
    ]);

    const deliveredBody = await getMailhogBodyForSubject(member.email, subject);
    expect(deliveredBody).toContain('Hallo Mitglieder');
    expect(deliveredBody).toContain('Testinhalt');
    expect(deliveredBody).toContain('Der Vorstand');
    expect(deliveredBody).not.toContain('**Testinhalt**');
    expect(deliveredBody).toContain(attachmentFilename);
    await expect.poll(() => getMailhogMessages(member.email, subject).then((messages) => messages.length)).toBe(1);

    const historySelect = page.getByTestId('admin-email-history');
    await historySelect.click();
    await page.getByRole('option', { name: sentEmail.subject }).click();
    await expect(page.getByTestId('admin-email-subject')).toHaveValue(subject);
    await expect(page.getByTestId('admin-email-subject')).toHaveJSProperty('readOnly', true);
    await expect(page.getByTestId('admin-email-body-desktop')).toHaveJSProperty('readOnly', true);
    await expect(page.getByTestId('admin-email-signature-desktop')).toHaveJSProperty('readOnly', true);
    await expect(page.getByTestId('admin-email-send')).toHaveCount(0);
    await expect(page.getByTestId('admin-email-attachment-link')).toContainText(attachmentFilename);

    await historySelect.click();
    await page.getByRole('option', { name: 'Neue E-Mail' }).click();
    await expect(page.getByTestId('admin-email-subject')).toHaveValue('');
    await expect(page.getByTestId('admin-email-subject')).toHaveJSProperty('readOnly', false);
    await expect(page.getByTestId('admin-email-body-desktop')).toHaveJSProperty('readOnly', false);
    await expect(page.getByTestId('admin-email-signature-desktop')).toHaveValue(signatureMarkdown);
    await expect(page.getByTestId('admin-email-send')).toBeVisible();

    const memberContext = await browser.newContext({
      storageState: authStatePaths.member,
      locale: 'de-DE',
      ignoreHTTPSErrors: true,
    });
    try {
      const memberPage = await memberContext.newPage();
      await memberPage.goto('/informationen');
      const jobsResponse = await memberPage.evaluate(async () => {
        const response = await fetch('/api/admin/emails/jobs');
        return response.status;
      });
      expect([401, 403]).toContain(jobsResponse);
      await memberPage.getByTestId('member-email-tab').click();
      const archive = memberPage.getByTestId('member-email-archive');
      await expect(archive).toBeVisible();
      const archivedSubject = archive.getByTestId('member-email-subject').filter({ hasText: subject });
      await expect(archivedSubject).toBeVisible();
      await archivedSubject.click();

      const detail = memberPage.getByTestId('member-email-detail');
      await expect(detail).toBeVisible();
      await expect(archive).toHaveCount(0);
      await expect(detail).toContainText(subject);
      await expect(detail).toContainText('Hallo Mitglieder');
      await expect(detail).toContainText('Testinhalt');
      await expect(detail).toContainText('Der Vorstand');
      await expect(detail).toContainText(attachmentFilename);
      await expect(detail.getByTestId('member-email-attachment-link')).toHaveAccessibleName(`${attachmentFilename} herunterladen`);

      const downloadPromise = memberPage.waitForEvent('download');
      const attachmentResponsePromise = memberPage.waitForResponse((response) =>
        response.url().includes(`/emails/${sentEmail.id}/attachments/${sentEmail.attachments[0].id}`) &&
        response.status() === 200,
      );
      await detail.getByTestId('member-email-attachment-link').click();
      const [download, attachmentResponse] = await Promise.all([
        downloadPromise,
        attachmentResponsePromise,
      ]);
      expect(download.suggestedFilename()).toBe(attachmentFilename);
      expect(await attachmentResponse.body()).toEqual(attachmentBuffer);

      await detail.getByTestId('member-email-back').click();
      await expect(archive).toBeVisible();
      await expect(archivedSubject).toBeVisible();
      await expect(detail).toHaveCount(0);
    } finally {
      await memberContext.close();
    }
  });

  test('same idempotency key creates one bulk job and one delivered message', async () => {
    const adminToken = await getAdminToken();
    const member = await getFirstMember(adminToken);
    const subject = `E2E idem ${e2eConfig.runId} ${Date.now()}`;
    const key = crypto.randomUUID();

    const send = () => {
      const body = new FormData();
      body.set('subject', subject);
      body.set('markdownContent', 'One idempotent delivery.');
      body.set('signatureMarkdown', 'E2E');
      return fetch(backendUrl('/admin/emails'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Idempotency-Key': key,
        },
        body,
      });
    };

    const responses = await Promise.all([send(), send()]);
    for (const response of responses) {
      expect(response.status, await response.clone().text()).toBe(202);
    }
    const acceptedJobs = await Promise.all(responses.map((response) => response.json() as Promise<EmailJob>));
    expect(acceptedJobs[0].id).toBe(acceptedJobs[1].id);
    expect(acceptedJobs[0].kind).toBe('BULK');
    await waitForJobStatus(adminToken, acceptedJobs[0].id, ['SENT']);
    await waitForMailhogMessages(member.email, subject, 1);
    expect(await getMailhogMessages(member.email, subject)).toHaveLength(1);
  });

  test('test email reaches admin and stays out of member archives', async ({ browser }) => {
    const adminToken = await getAdminToken();
    const subject = `E2E TEST ${e2eConfig.runId} ${Date.now()}`;
    const body = new FormData();
    body.set('subject', subject);
    body.set('markdownContent', 'Administrator only.');
    body.set('signatureMarkdown', 'E2E');
    const response = await fetch(backendUrl('/admin/emails/test'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Idempotency-Key': crypto.randomUUID(),
      },
      body,
    });
    expect(response.status, await response.clone().text()).toBe(202);
    const accepted = await response.json() as EmailJob;
    expect(accepted.kind).toBe('TEST');
    await waitForJobStatus(adminToken, accepted.id, ['SENT']);
    const testDelivery = await waitForMailhogMessages('admins@chorhub.test', subject, 1);
    expect(testDelivery).toHaveLength(1);
    expect(testDelivery[0].To.map(({ Mailbox, Domain }) => `${Mailbox}@${Domain}`)).toEqual([
      'admins@chorhub.test',
    ]);

    const adminArchiveResponse = await fetch(backendUrl('/admin/emails'), {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(adminArchiveResponse.ok).toBeTruthy();
    const adminArchive = await adminArchiveResponse.json() as SentEmailSummary[];
    expect(adminArchive.some((email) => email.rawSubject === subject)).toBe(false);

    const memberContext = await browser.newContext({
      storageState: authStatePaths.member,
      locale: 'de-DE',
      ignoreHTTPSErrors: true,
    });
    try {
      const memberPage = await memberContext.newPage();
      await memberPage.goto('/informationen');
      await memberPage.getByTestId('member-email-tab').click();
      await expect(memberPage.getByTestId('member-email-archive')).not.toContainText(subject);
    } finally {
      await memberContext.close();
    }
  });

  test('HTTP acceptance and job status stay responsive while SMTP acknowledgement is held', async () => {
    const adminToken = await getAdminToken();
    const subject = `E2E HOLD ${e2eConfig.runId} ${Date.now()}`;
    const marker = `EH${Date.now()}`;
    const control = await armSmtpControl(marker, 'hold');
    const body = new FormData();
    body.set('subject', `${subject} ${marker}`);
    body.set('markdownContent', 'Held by isolated SMTP fixture.');
    body.set('signatureMarkdown', 'E2E');

    let accepted: EmailJob | undefined;
    try {
      const response = await fetch(backendUrl('/admin/emails/test'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Idempotency-Key': crypto.randomUUID(),
        },
        body,
        signal: AbortSignal.timeout(5_000),
      });
      expect(response.status, await response.clone().text()).toBe(202);
      accepted = await response.json() as EmailJob;
      await waitForSmtpControl(control.id, 'held');

      const before = performance.now();
      const whileHeld = await readJob(adminToken, accepted.id);
      expect(performance.now() - before).toBeLessThan(2_000);
      expect(['PENDING', 'SENDING']).toContain(whileHeld.status);

      const release = await fetch(smtpFixtureUrl(`/controls/${control.id}/release`), { method: 'POST' });
      expect(release.ok).toBeTruthy();
      await waitForJobStatus(adminToken, accepted.id, ['SENT']);
      await waitForMailhogMessages('admins@chorhub.test', marker, 1);
    } finally {
      if (await smtpControlState(control.id) === 'held') {
        await fetch(smtpFixtureUrl(`/controls/${control.id}/release`), { method: 'POST' });
      }
    }
  });

  test('SMTP rejection becomes failed job and does not deliver message', async () => {
    const adminToken = await getAdminToken();
    const subject = `E2E REJECT ${e2eConfig.runId} ${Date.now()}`;
    const marker = `ER${Date.now()}`;
    const control = await armSmtpControl(marker, 'reject');
    const body = new FormData();
    body.set('subject', `${subject} ${marker}`);
    body.set('markdownContent', 'Rejected by isolated SMTP fixture.');
    body.set('signatureMarkdown', 'E2E');
    const response = await fetch(backendUrl('/admin/emails/test'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Idempotency-Key': crypto.randomUUID(),
      },
      body,
    });
    expect(response.status, await response.clone().text()).toBe(202);
    const accepted = await response.json() as EmailJob;
    await waitForSmtpControl(control.id, 'rejected');
    const failed = await waitForJobStatus(adminToken, accepted.id, ['FAILED']);
    expect(failed.status).toBe('FAILED');
    expect(await getMailhogMessages('admins@chorhub.test', marker)).toHaveLength(0);
  });
});
