import * as fs from 'fs';
import { expect, test } from '@playwright/test';
import { authStatePaths, backendUrl, e2eConfig, mailhogUrl } from '../config';
import { getAdminToken, getFirstMember } from '../helpers/api';
import { getLatestMailBody } from '../helpers/mailhog';

interface BilingualText {
  de: string;
  en: string;
}

interface MailTemplateScenario {
  id: string;
  name: BilingualText;
}

interface MailTemplate {
  key: string;
  name: BilingualText;
  description: BilingualText;
  subjectTemplate: string;
  htmlTemplate: string;
  updatedAt: string | null;
  placeholders: {
    name: string;
    description: BilingualText;
    example: string;
    syntax: string;
    optional?: boolean;
    scope?: string;
  }[];
  previewScenarios: MailTemplateScenario[];
}

interface MailTemplateCatalog {
  templates: MailTemplate[];
}

interface TemplatePreview {
  subject: string;
  html: string;
}

interface EmailSummary {
  id: string;
  subject: string;
  rawSubject: string;
  markdownContent: string;
}

interface StoredAuthState {
  origins?: {
    localStorage?: { name: string; value: string }[];
  }[];
}

interface StoredAuthValue {
  state?: {
    memberSession?: { token?: string };
  };
}

interface MailHogMessage {
  To: { Mailbox: string; Domain: string }[];
  Content: {
    Body: string;
    Headers: Record<string, string[]>;
  };
  Created: string;
}

interface MailHogResponse {
  items: MailHogMessage[];
}

function templateUrl(key?: string, action?: 'preview'): string {
  return backendUrl(`/admin/mail-templates${key ? `/${key}` : ''}${action ? `/${action}` : ''}`);
}

function adminHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function getCatalog(token: string): Promise<MailTemplate[]> {
  const response = await fetch(templateUrl(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`GET /admin/mail-templates failed: ${response.status}`);
  const result = await response.json() as MailTemplateCatalog;
  return result.templates;
}

async function getTemplate(token: string, key: string): Promise<MailTemplate> {
  const templates = await getCatalog(token);
  const template = templates.find((candidate) => candidate.key === key);
  if (!template) throw new Error(`Mail template ${key} was not returned`);
  return template;
}

async function updateTemplate(
  token: string,
  template: Pick<MailTemplate, 'key' | 'subjectTemplate' | 'htmlTemplate'>,
): Promise<Response> {
  return fetch(templateUrl(template.key), {
    method: 'PUT',
    headers: adminHeaders(token),
    body: JSON.stringify({
      subjectTemplate: template.subjectTemplate,
      htmlTemplate: template.htmlTemplate,
    }),
  });
}

function getStoredMemberToken(): string {
  const state = JSON.parse(fs.readFileSync(authStatePaths.member, 'utf-8')) as StoredAuthState;
  const authEntry = state.origins
    ?.flatMap((origin) => origin.localStorage ?? [])
    .find((entry) => entry.name === 'chorhub-auth');
  if (!authEntry) throw new Error('Member auth state has no chorhub-auth entry');

  const authValue = JSON.parse(authEntry.value) as StoredAuthValue;
  const token = authValue.state?.memberSession?.token;
  if (!token) throw new Error('Member auth state has no member token');
  return token;
}

test.describe('Admin mail templates', () => {
  test.describe.configure({ mode: 'serial' });

  test('protects template APIs, previews every scenario, and rejects unknown placeholders', async () => {
    const adminToken = await getAdminToken();
    const memberToken = getStoredMemberToken();

    const unauthenticated = await fetch(templateUrl());
    expect(unauthenticated.status).toBe(401);

    const memberRequest = await fetch(templateUrl(), {
      headers: { 'X-Member-Token': memberToken },
    });
    expect(memberRequest.status).toBe(401);

    const unknownTemplate = await fetch(templateUrl('unknown-e2e-template', 'preview'), {
      method: 'POST',
      headers: adminHeaders(adminToken),
      body: JSON.stringify({
        subjectTemplate: 'Unknown',
        htmlTemplate: '<p>Unknown</p>',
        scenarioId: 'standard',
      }),
    });
    expect(unknownTemplate.status).toBe(404);

    const templates = await getCatalog(adminToken);
    expect(templates).toHaveLength(6);
    expect(templates.map((template) => template.key)).toEqual(expect.arrayContaining([
      'magic-link',
      'invite',
      'push-fallback-reminder',
      'personal-info',
      'member-disabled',
      'admin-member-disabled',
    ]));

    for (const template of templates) {
      expect(template.description.de).toBeTruthy();
      expect(template.description.en).toBeTruthy();
      expect(template.placeholders.length).toBeGreaterThan(0);

      for (const scenario of template.previewScenarios) {
        const response = await fetch(templateUrl(template.key, 'preview'), {
          method: 'POST',
          headers: adminHeaders(adminToken),
          body: JSON.stringify({
            subjectTemplate: template.subjectTemplate,
            htmlTemplate: template.htmlTemplate,
            scenarioId: scenario.id,
          }),
        });
        const details = await response.text();
        expect(
          response.ok,
          `Preview ${template.key}/${scenario.id} returned ${response.status}: ${details}`,
        ).toBeTruthy();
        const preview = JSON.parse(details) as TemplatePreview;
        expect(preview.subject.trim()).not.toBe('');
        expect(preview.html.trim()).not.toBe('');
      }
    }

    const reminder = templates.find((template) => template.key === 'push-fallback-reminder');
    expect(reminder?.previewScenarios.map((scenario) => scenario.id)).toEqual(
      expect.arrayContaining(['with-actions', 'without-actions', 'generic-login']),
    );
    const personalInfo = templates.find((template) => template.key === 'personal-info');
    expect(personalInfo?.previewScenarios.map((scenario) => scenario.id)).toEqual(
      expect.arrayContaining(['personal', 'bulk']),
    );

    const original = await getTemplate(adminToken, 'admin-member-disabled');
    const invalidUpdate = await updateTemplate(adminToken, {
      key: original.key,
      subjectTemplate: '{{unknownE2ePlaceholder}}',
      htmlTemplate: original.htmlTemplate,
    });
    expect(invalidUpdate.status).toBe(400);
    const afterInvalidUpdate = await getTemplate(adminToken, original.key);
    expect(afterInvalidUpdate.subjectTemplate).toBe(original.subjectTemplate);
    expect(afterInvalidUpdate.htmlTemplate).toBe(original.htmlTemplate);
  });

  test('saves templates, guards dirty navigation, and sends with rendered subject', async ({ page }) => {
    const adminToken = await getAdminToken();
    const member = await getFirstMember(adminToken);
    const original = await getTemplate(adminToken, 'personal-info');
    const marker = `mail-template-e2e-${e2eConfig.runId}-${Date.now()}`;
    const rawSubject = `E2E raw subject ${e2eConfig.runId} ${Date.now()}`;
    const markdownContent = `# ${marker}\n\nThis body verifies custom template delivery.`;
    const signatureMarkdown = 'E2E signature';
    const customSubjectTemplate = '{{rawSubject}}';
    const customHtmlTemplate = '<!doctype html><html><body><main><h1>{{rawSubject}}</h1><section>{{{htmlContent}}}</section><footer>{{{htmlSignature}}}</footer></main></body></html>';
    let templateChanged = false;

    try {
      await page.goto('/admin/einstellungen');
      const section = page.getByTestId('admin-mail-templates');
      await expect(section).toBeVisible();

      const selector = page.getByTestId('admin-mail-template-select').locator('button');
      await selector.click();
      await page.getByRole('option', { name: 'Persönliche Information' }).click();

      await expect(page.getByTestId('admin-mail-template-subject')).toHaveValue(original.subjectTemplate);
      await expect(page.getByTestId('admin-mail-template-preview-frame')).toHaveAttribute('sandbox', '');
      const previewSecurity = await page.getByTestId('admin-mail-template-preview-frame').evaluate((frame) => {
        const source = frame.getAttribute('srcdoc') ?? '';
        const policy = source.match(/Content-Security-Policy[^>]*content="([^"]+)"/i)?.[1] ?? '';
        return { policy, source };
      });
      expect(previewSecurity.policy).toContain("default-src 'none'");
      expect(previewSecurity.policy).toContain("form-action 'none'");
      expect(previewSecurity.policy).toContain("base-uri 'none'");
      expect(previewSecurity.policy).not.toContain('allow-scripts');

      const desktopLayout = await page.evaluate(() => {
        const editor = document.querySelector('[data-testid="admin-mail-template-editor"]');
        const preview = document.querySelector('[data-testid="admin-mail-template-preview"]');
        return {
          viewportWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          editorLeft: editor?.getBoundingClientRect().left ?? 0,
          previewLeft: preview?.getBoundingClientRect().left ?? 0,
        };
      });
      expect(desktopLayout.documentWidth).toBeLessThanOrEqual(desktopLayout.viewportWidth);
      expect(desktopLayout.previewLeft).toBeGreaterThan(desktopLayout.editorLeft);

      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.getByTestId('admin-mail-template-mobile-editor')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('admin-mail-template-editor')).toBeVisible();
      await expect(page.getByTestId('admin-mail-template-preview')).toBeHidden();
      const mobileWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(mobileWidth).toBeLessThanOrEqual(390);
      const mobileActionBounds = await page.evaluate(() => {
        const section = document.querySelector('[data-testid="admin-mail-templates"]');
        const save = document.querySelector('[data-testid="admin-mail-template-save"]');
        const discard = document.querySelector('[data-testid="admin-mail-template-discard"]');
        return {
          sectionRight: section?.getBoundingClientRect().right ?? 0,
          saveRight: save?.getBoundingClientRect().right ?? 0,
          saveScrollWidth: save?.scrollWidth ?? 0,
          saveClientWidth: save?.clientWidth ?? 0,
          discardRight: discard?.getBoundingClientRect().right ?? 0,
        };
      });
      expect(mobileActionBounds.saveRight).toBeLessThanOrEqual(mobileActionBounds.sectionRight);
      expect(mobileActionBounds.discardRight).toBeLessThanOrEqual(mobileActionBounds.sectionRight);
      expect(mobileActionBounds.saveScrollWidth).toBeLessThanOrEqual(mobileActionBounds.saveClientWidth);
      await page.getByTestId('admin-mail-template-mobile-preview').click();
      await expect(page.getByTestId('admin-mail-template-editor')).toBeHidden();
      await expect(page.getByTestId('admin-mail-template-preview')).toBeVisible();
      await page.getByTestId('admin-mail-template-mobile-editor').click();

      const htmlEditor = page.getByTestId('admin-mail-template-html');
      await htmlEditor.fill('<p>Preview isolation probe</p><script>parent.document.documentElement.dataset.previewPwned = "true"</script>');
      await expect(page.getByTestId('admin-mail-template-save')).toBeEnabled();
      await expect.poll(async () =>
        page.getByTestId('admin-mail-template-preview-frame').getAttribute('srcdoc'),
      ).toContain('Preview isolation probe');
      await expect.poll(async () => page.locator('html').getAttribute('data-preview-pwned')).toBeNull();

      await page.getByTestId('admin-mail-template-subject').fill('Unsaved test draft');
      await selector.click();
      const rejectSwitch = page.waitForEvent('dialog').then((dialog) => dialog.dismiss());
      await page.getByRole('option', { name: 'Einladung' }).click();
      await rejectSwitch;
      await expect(page.getByTestId('admin-mail-template-subject')).toHaveValue('Unsaved test draft');
      await expect(selector).toContainText('Persönliche Information');

      await page.getByTestId('admin-mail-template-subject').fill('Accept this template switch draft');
      await selector.click();
      const acceptSwitch = page.waitForEvent('dialog').then((dialog) => dialog.accept());
      await page.getByRole('option', { name: 'Einladung' }).click();
      await acceptSwitch;
      await expect(selector).toContainText('Einladung');
      await selector.click();
      await page.getByRole('option', { name: 'Persönliche Information' }).click();
      await expect(page.getByTestId('admin-mail-template-subject')).toHaveValue(original.subjectTemplate);

      await page.getByTestId('admin-mail-template-subject').fill(customSubjectTemplate);
      await htmlEditor.fill(customHtmlTemplate);
      const saveResponsePromise = page.waitForResponse((response) =>
        response.request().method() === 'PUT' &&
        new URL(response.url()).pathname.endsWith('/admin/mail-templates/personal-info'),
      );
      templateChanged = true;
      await page.getByTestId('admin-mail-template-save').click();
      const saveResponse = await saveResponsePromise;
      expect(saveResponse.ok(), `Template save returned ${saveResponse.status()}`).toBeTruthy();

      const saved = await getTemplate(adminToken, 'personal-info');
      expect(saved.subjectTemplate).toBe(customSubjectTemplate);
      expect(saved.htmlTemplate).toBe(customHtmlTemplate);

      await page.reload();
      await selector.click();
      await page.getByRole('option', { name: 'Persönliche Information' }).click();
      await expect(page.getByTestId('admin-mail-template-subject')).toHaveValue(customSubjectTemplate);
      await expect(page.getByTestId('admin-mail-template-html')).toHaveValue(customHtmlTemplate);

      await page.getByTestId('admin-mail-template-subject').fill('Discard this draft');
      await page.getByTestId('admin-mail-template-discard').click();
      await expect(page.getByTestId('admin-mail-template-subject')).toHaveValue(customSubjectTemplate);

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.getByTestId('admin-mail-template-subject').fill('Cancel navigation draft');
      const rejectNavigation = page.waitForEvent('dialog').then((dialog) => dialog.dismiss());
      await page.getByRole('link', { name: 'Mitglieder' }).click();
      await rejectNavigation;
      await expect(page).toHaveURL(/\/admin\/einstellungen$/);
      await expect(page.getByTestId('admin-mail-template-subject')).toHaveValue('Cancel navigation draft');
      await page.getByTestId('admin-mail-template-discard').click();

      await page.getByTestId('admin-mail-template-subject').fill('Accept this navigation draft');
      const acceptNavigation = page.waitForEvent('dialog').then((dialog) => dialog.accept());
      await page.getByRole('link', { name: 'Mitglieder' }).click();
      await acceptNavigation;
      await expect(page).toHaveURL(/\/admin\/mitglieder$/);
      await page.goto('/admin/einstellungen');
      await selector.click();
      await page.getByRole('option', { name: 'Persönliche Information' }).click();
      await expect(page.getByTestId('admin-mail-template-subject')).toHaveValue(customSubjectTemplate);

      await page.goto('/admin/informationen/email');
      await page.setViewportSize({ width: 1280, height: 720 });
      await expect(page.getByTestId('admin-email-composer')).toBeVisible();
      await page.getByTestId('admin-email-subject').fill(rawSubject);
      await page.getByTestId('admin-email-body-desktop').fill(markdownContent);
      await page.getByTestId('admin-email-signature-desktop').fill(signatureMarkdown);

      const sendResponsePromise = page.waitForResponse((response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname.endsWith('/admin/emails'),
      );
      await page.getByTestId('admin-email-send').click();
      const sendResponse = await sendResponsePromise;
      const sent = await sendResponse.json() as EmailSummary;
      expect(sendResponse.ok()).toBeTruthy();
      expect(sent.rawSubject).toBe(rawSubject);
      expect(sent.subject).toBe(rawSubject);

      const archiveResponse = await fetch(backendUrl('/admin/emails'), {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(archiveResponse.ok).toBeTruthy();
      const archive = await archiveResponse.json() as EmailSummary[];
      const archived = archive.find((email) => email.id === sent.id);
      expect(archived?.rawSubject).toBe(rawSubject);
      expect(archived?.subject).toBe(rawSubject);
      expect(archived?.markdownContent.replace(/\r\n/g, '\n')).toBe(markdownContent);

      const mailhogResponse = await fetch(mailhogUrl('/api/v2/messages?limit=100'));
      expect(mailhogResponse.ok).toBeTruthy();
      const mailhogData = await mailhogResponse.json() as MailHogResponse;
      const [mailbox, domain] = member.email.toLowerCase().split('@');
      const delivery = (mailhogData.items ?? [])
        .filter((message) => message.To.some((address) =>
          address.Mailbox.toLowerCase() === mailbox && address.Domain.toLowerCase() === domain,
        ))
        .sort((left, right) => new Date(right.Created).getTime() - new Date(left.Created).getTime())[0];
      expect(delivery, `No MailHog message found for ${member.email}`).toBeTruthy();
      expect(delivery?.Content.Headers.Subject?.[0]).toBe(rawSubject);
      const deliveredBody = await getLatestMailBody(member.email);
      expect(deliveredBody).toContain(marker);
      expect(deliveredBody).toContain(signatureMarkdown);
      expect(deliveredBody).not.toContain(`[Popchor Mitglieder] ${rawSubject}`);
    } finally {
      if (templateChanged) {
        const restore = await updateTemplate(adminToken, original);
        if (!restore.ok) {
          throw new Error(`Could not restore personal-info template: ${restore.status} ${await restore.text()}`);
        }
      }
    }
  });
});
