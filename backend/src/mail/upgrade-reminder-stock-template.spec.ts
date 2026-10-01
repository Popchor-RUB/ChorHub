import { loadMailTemplateDefaults } from './load-mail-template-defaults';
import { upgradeReminderStockTemplate } from './upgrade-reminder-stock-template';

describe('upgradeReminderStockTemplate', () => {
  it.each(['stock', 'subject', 'body', 'footer', 'concurrent edit'])(
    'safely handles %s template',
    async (scenario) => {
      const defaults = await loadMailTemplateDefaults();
      const current = defaults.find(({ key }) => key === 'push-fallback-reminder')!;
      const legacyHtml = current.htmlTemplate.replace(
        /^ *<td width="8"[^\n]+$/m,
        [
          '                </tr>',
          '                <tr><td height="8" style="height:8px;font-size:0;line-height:0;">&nbsp;</td></tr>',
          '                <tr>',
        ].join('\n'),
      );
      const stored = {
        subjectTemplate: scenario === 'subject' ? 'Custom subject' : current.subjectTemplate,
        htmlTemplate: scenario === 'body'
          ? legacyHtml.replace('{{intro}}', 'Custom introduction')
          : scenario === 'footer'
            ? legacyHtml.replace('ChorHub öffnen', 'Custom footer')
            : legacyHtml,
      };
      const original = { ...stored };
      let updated = 0;
      const update: Parameters<typeof upgradeReminderStockTemplate>[0] = async (where, data) => {
        if (scenario === 'concurrent edit') stored.htmlTemplate += '<p>Concurrent edit</p>';
        if (where.subjectTemplate !== stored.subjectTemplate || where.htmlTemplate !== stored.htmlTemplate) return 0;
        stored.htmlTemplate = data.htmlTemplate;
        updated += 1;
        return 1;
      };

      await upgradeReminderStockTemplate(update, defaults);
      await upgradeReminderStockTemplate(update, defaults);

      expect(legacyHtml).not.toBe(current.htmlTemplate);
      expect(updated).toBe(scenario === 'stock' ? 1 : 0);
      if (scenario === 'stock') expect(stored.htmlTemplate).toBe(current.htmlTemplate);
      else if (scenario === 'concurrent edit') expect(stored.htmlTemplate).toContain('Concurrent edit');
      else expect(stored).toEqual(original);
    },
  );
});
