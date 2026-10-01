import { loadMailTemplateDefaults } from './load-mail-template-defaults';
import {
  upgradeMemberDisabledStockTemplate,
  type MemberDisabledStockTemplateWhere,
  type UpdateMemberDisabledStockTemplate,
} from './upgrade-member-disabled-stock-template';

const CURRENT_CONTACT =
  'Dein Zugang zu ChorHub wurde deaktiviert. Bitte wende dich per E-Mail an das Orga-Team, um deinen Zugang zu klären oder wieder aktivieren zu lassen.';

function legacyHtml(htmlTemplate: string, contactText: string): string {
  return htmlTemplate
    .replace(/\n\s*{{#if reason}}[\s\S]*?{{\/if}}\n/, '\n')
    .replace(
      `<p style="margin:0 0 16px;">${CURRENT_CONTACT}</p>`,
      `<p style="margin:0 0 16px;">${contactText}</p>`,
    );
}

describe('upgradeMemberDisabledStockTemplate', () => {
  it.each([
    'Dein Zugang zu ChorHub wurde deaktiviert. Bitte wende dich per E-Mail an die Chor-Admins, um deinen Zugang zu klären oder wieder aktivieren zu lassen.',
    CURRENT_CONTACT,
  ])('upgrades exact legacy stock with contact copy: %s', async (contactText) => {
    const defaults = await loadMailTemplateDefaults();
    const current = defaults.find(({ key }) => key === 'member-disabled')!;
    const original = {
      subjectTemplate: current.subjectTemplate,
      htmlTemplate: legacyHtml(current.htmlTemplate, contactText),
    };
    let stored = { ...original };
    let updated = 0;

    const update: UpdateMemberDisabledStockTemplate = async (
      where: MemberDisabledStockTemplateWhere,
      data,
    ) => {
      if (
        where.key === 'member-disabled' &&
        where.subjectTemplate === stored.subjectTemplate &&
        where.htmlTemplate === stored.htmlTemplate
      ) {
        stored = { subjectTemplate: data.subjectTemplate, htmlTemplate: data.htmlTemplate };
        updated += 1;
        return 1;
      }
      return 0;
    };

    await upgradeMemberDisabledStockTemplate(update, defaults);
    await upgradeMemberDisabledStockTemplate(update, defaults);

    expect(original.htmlTemplate).toContain('ChorHub öffnen');
    expect(original.htmlTemplate).not.toContain('{{> footer}}');
    expect(stored).toEqual({
      subjectTemplate: current.subjectTemplate,
      htmlTemplate: current.htmlTemplate,
    });
    expect(updated).toBe(1);
  });

  it.each([
    { label: 'subject', subjectTemplate: 'Custom subject', htmlSuffix: '' },
    { label: 'HTML', subjectTemplate: undefined, htmlSuffix: '<p>customized body</p>' },
    { label: 'footer', subjectTemplate: undefined, htmlSuffix: '<p>custom footer content</p>' },
  ])('preserves customization to $label', async ({ subjectTemplate, htmlSuffix }) => {
    const defaults = await loadMailTemplateDefaults();
    const current = defaults.find(({ key }) => key === 'member-disabled')!;
    let stored = {
      subjectTemplate: subjectTemplate ?? current.subjectTemplate,
      htmlTemplate: `${legacyHtml(current.htmlTemplate, CURRENT_CONTACT)}${htmlSuffix}`,
    };
    const original = { ...stored };

    await upgradeMemberDisabledStockTemplate(async (where, data) => {
      if (where.subjectTemplate === stored.subjectTemplate && where.htmlTemplate === stored.htmlTemplate) {
        stored = { subjectTemplate: data.subjectTemplate, htmlTemplate: data.htmlTemplate };
        return 1;
      }
      return 0;
    }, defaults);

    expect(stored).toEqual(original);
  });

  it('does not overwrite an edit made between reading the stock candidate and conditional update', async () => {
    const defaults = await loadMailTemplateDefaults();
    const current = defaults.find(({ key }) => key === 'member-disabled')!;
    const stored = {
      subjectTemplate: current.subjectTemplate,
      htmlTemplate: legacyHtml(current.htmlTemplate, CURRENT_CONTACT),
    };
    const concurrentEdit = '<p>Admin edit during startup</p>';

    await upgradeMemberDisabledStockTemplate(async (where, data) => {
      stored.htmlTemplate += concurrentEdit;
      if (where.subjectTemplate === stored.subjectTemplate && where.htmlTemplate === stored.htmlTemplate) {
        stored.subjectTemplate = data.subjectTemplate;
        stored.htmlTemplate = data.htmlTemplate;
        return 1;
      }
      return 0;
    }, defaults);

    expect(stored.htmlTemplate).toContain(concurrentEdit);
    expect(stored.htmlTemplate).not.toBe(current.htmlTemplate);
  });
});
