import { expect, test } from '@playwright/test';
import { backendUrl, e2eConfig, authStatePaths } from '../config';
import { getAdminToken, getFirstMember } from '../helpers/api';
import { getLatestMailBody } from '../helpers/mailhog';

interface SentEmailSummary {
  id: string;
  subject: string;
  rawSubject: string;
  markdownContent: string;
  signatureMarkdown: string;
  sentAt: string;
  attachments: { id: string; filename: string; contentType: string; size: number }[];
}

test.describe('Admin email composer and member archive', () => {
  test('sends one email, archives it read-only, and shows it to members', async ({ page, browser }) => {
    const adminToken = await getAdminToken();
    const member = await getFirstMember(adminToken);
    const subject = `E2E Rundmail ${e2eConfig.runId} ${Date.now()}`;
    const markdownContent = '# Hallo Mitglieder\n\nDies ist der **Testinhalt** der Rundmail.';
    const signatureMarkdown = 'Viele Grüße,\n\n**Der Vorstand**';
    const attachmentFilename = 'rundmail-anhang.txt';
    const attachmentText = `Anhang für ${subject}`;
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
    await expect(page.getByTestId('admin-email-prefix')).toContainText('[Popchor Mitglieder]');

    await page.getByTestId('admin-email-subject').fill(subject);
    await page.getByTestId('admin-email-body-desktop').fill(markdownContent);
    await page.getByTestId('admin-email-signature-desktop').fill(signatureMarkdown);
    await page.getByTestId('admin-email-attachments').setInputFiles({
      name: attachmentFilename,
      mimeType: 'text/plain',
      buffer: Buffer.from(attachmentText),
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
      sendResponse.ok(),
      `POST /admin/emails returned ${sendResponse.status()}: ${sendResponseBody}`,
    ).toBeTruthy();
    const sentFromResponse = JSON.parse(sendResponseBody) as SentEmailSummary;
    await expect(page.getByRole('status')).toContainText('E-Mail wurde gesendet.');
    expect(sendRequests).toBe(1);

    const historyResponse = await fetch(backendUrl('/admin/emails'), {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(historyResponse.ok).toBeTruthy();
    const history = await historyResponse.json() as SentEmailSummary[];
    const matches = history.filter((email) => email.rawSubject === subject);
    expect(sentFromResponse.rawSubject).toBe(subject);
    expect(
      matches,
      `History subjects: ${JSON.stringify(history.map((email) => ({ subject: email.subject, rawSubject: email.rawSubject })))}`,
    ).toHaveLength(1);

    const sentEmail = matches[0];
    expect(sentEmail.subject).toBe(`[Popchor Mitglieder] ${subject}`);
    expect(sentEmail.markdownContent.replace(/\r\n/g, '\n')).toBe(markdownContent);
    expect(sentEmail.signatureMarkdown.replace(/\r\n/g, '\n')).toBe(signatureMarkdown);
    expect(sentEmail.attachments).toEqual([
      expect.objectContaining({ filename: attachmentFilename, contentType: 'text/plain' }),
    ]);

    const deliveredBody = await getLatestMailBody(member.email);
    expect(deliveredBody).toContain('Hallo Mitglieder');
    expect(deliveredBody).toContain('Testinhalt');
    expect(deliveredBody).toContain('Der Vorstand');
    expect(deliveredBody).not.toContain('**Testinhalt**');
    expect(deliveredBody).toContain(attachmentFilename);

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
      await memberPage.getByTestId('member-email-tab').click();
      const archive = memberPage.getByTestId('member-email-archive');
      await expect(archive).toBeVisible();
      const archivedSubject = archive.getByTestId('member-email-subject').filter({ hasText: subject });
      await expect(archivedSubject).toBeVisible();
      await archivedSubject.click();

      const detail = memberPage.getByTestId('member-email-detail');
      await expect(detail).toBeVisible();
      await expect(archive).toHaveCount(0);
      await expect(detail).toContainText(`[Popchor Mitglieder] ${subject}`);
      await expect(detail).toContainText('Hallo Mitglieder');
      await expect(detail).toContainText('Testinhalt');
      await expect(detail).toContainText('Der Vorstand');
      await expect(detail.getByTestId('member-email-attachment-link')).toContainText(attachmentFilename);

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
      expect(await attachmentResponse.body()).toEqual(Buffer.from(attachmentText));

      await detail.getByTestId('member-email-back').click();
      await expect(archive).toBeVisible();
      await expect(archivedSubject).toBeVisible();
      await expect(detail).toHaveCount(0);
    } finally {
      await memberContext.close();
    }
  });
});
