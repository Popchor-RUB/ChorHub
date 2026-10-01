import { loadMailTemplateDefaults } from './load-mail-template-defaults';
import { hashMailTemplateHtml } from './hash-mail-template';
import { MAIL_TEMPLATE_HASHES } from './mail-template-hashes';
import { MAIL_TEMPLATE_DEFINITIONS } from './mail-template.catalog';
import { upgradeKnownMailTemplateDefaults } from './upgrade-known-mail-template-defaults';
import type { MailTemplateKey } from './mail-template.types';

describe('upgradeKnownMailTemplateDefaults', () => {
  it('upgrades recognized older HTML with conditional key and original HTML, preserving subject', async () => {
    const defaults = await loadMailTemplateDefaults();
    const current = defaults.find(({ key }) => key === 'invite')!;
    const oldHtml = '<p>previous stock body</p>';
    const hashes: Record<MailTemplateKey, readonly string[]> = {
      ...MAIL_TEMPLATE_HASHES,
      invite: [hashMailTemplateHtml(oldHtml)],
    };
    const stored = { key: 'invite', htmlTemplate: oldHtml };
    const update = jest.fn(async () => 1);

    await upgradeKnownMailTemplateDefaults(defaults, [stored], update, hashes);

    expect(update).toHaveBeenCalledWith(
      { key: 'invite', htmlTemplate: oldHtml },
      { htmlTemplate: current.htmlTemplate },
    );
  });

  it.each(['body', 'footer', 'whitespace'])(
    'preserves unknown %s edits',
    async (edit) => {
      const defaults = await loadMailTemplateDefaults();
      const current = defaults.find(({ key }) => key === 'invite')!;
      const storedHtml = edit === 'body'
        ? `${current.htmlTemplate}<!-- customized body -->`
        : edit === 'footer'
          ? current.htmlTemplate.replace('ChorHub öffnen', 'My custom footer')
          : `${current.htmlTemplate}\n`;
      const update = jest.fn(async () => 1);

      expect(storedHtml).not.toBe(current.htmlTemplate);
      await upgradeKnownMailTemplateDefaults(defaults, [
        { key: 'invite', htmlTemplate: storedHtml },
      ], update);

      expect(update).not.toHaveBeenCalled();
    },
  );

  it('does not let a hash registered under another key authorize replacement', async () => {
    const defaults = await loadMailTemplateDefaults();
    const otherKeyHtml = '<p>old stock for another key</p>';
    const hashes: Record<MailTemplateKey, readonly string[]> = {
      ...MAIL_TEMPLATE_HASHES,
      'magic-link': [hashMailTemplateHtml(otherKeyHtml)],
    };
    const update = jest.fn(async () => 1);

    await upgradeKnownMailTemplateDefaults(defaults, [
      { key: 'invite', htmlTemplate: otherKeyHtml },
    ], update, hashes);

    expect(update).not.toHaveBeenCalled();
  });

  it('upgrades once, then remains idempotent after successful replacement', async () => {
    const defaults = await loadMailTemplateDefaults();
    const current = defaults.find(({ key }) => key === 'invite')!;
    const oldHtml = '<p>previous stock body</p>';
    const hashes: Record<MailTemplateKey, readonly string[]> = {
      ...MAIL_TEMPLATE_HASHES,
      invite: [hashMailTemplateHtml(oldHtml)],
    };
    let storedHtml = oldHtml;
    const update = jest.fn(async (_where, data) => {
      storedHtml = data.htmlTemplate;
      return 1;
    });

    await upgradeKnownMailTemplateDefaults(defaults, [
      { key: 'invite', htmlTemplate: storedHtml },
    ], update, hashes);
    await upgradeKnownMailTemplateDefaults(defaults, [
      { key: 'invite', htmlTemplate: storedHtml },
    ], update, hashes);

    expect(storedHtml).toBe(current.htmlTemplate);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('skips HTML that already matches current default', async () => {
    const defaults = await loadMailTemplateDefaults();
    const current = defaults.find(({ key }) => key === 'invite')!;
    const update = jest.fn(async () => 1);

    await upgradeKnownMailTemplateDefaults(defaults, [
      { key: 'invite', htmlTemplate: current.htmlTemplate },
    ], update);

    expect(update).not.toHaveBeenCalled();
  });

  it('leaves concurrent HTML edits in place when conditional update matches no row', async () => {
    const defaults = await loadMailTemplateDefaults();
    const oldHtml = '<p>previous stock body</p>';
    const concurrentHtml = `${oldHtml}<p>concurrent edit</p>`;
    const hashes: Record<MailTemplateKey, readonly string[]> = {
      ...MAIL_TEMPLATE_HASHES,
      invite: [hashMailTemplateHtml(oldHtml)],
    };
    let storedHtml = oldHtml;
    const update = jest.fn(async (where: { key: MailTemplateKey; htmlTemplate: string }) => {
      storedHtml = concurrentHtml;
      return where.htmlTemplate === storedHtml ? 1 : 0;
    });

    await upgradeKnownMailTemplateDefaults(defaults, [
      { key: 'invite', htmlTemplate: oldHtml },
    ], update, hashes);

    expect(update).toHaveBeenCalledWith({ key: 'invite', htmlTemplate: oldHtml }, expect.anything());
    expect(update).toHaveBeenCalledTimes(1);
    expect(storedHtml).toBe(concurrentHtml);
  });

  it('propagates conditional update failures', async () => {
    const defaults = await loadMailTemplateDefaults();
    const oldHtml = '<p>previous stock body</p>';
    const hashes: Record<MailTemplateKey, readonly string[]> = {
      ...MAIL_TEMPLATE_HASHES,
      invite: [hashMailTemplateHtml(oldHtml)],
    };
    const databaseError = new Error('database update failed');

    await expect(upgradeKnownMailTemplateDefaults(
      defaults,
      [{ key: 'invite', htmlTemplate: oldHtml }],
      async () => { throw databaseError; },
      hashes,
    )).rejects.toBe(databaseError);
  });

  it('registers hashes for each current expanded default', async () => {
    const defaults = await loadMailTemplateDefaults();

    expect(Object.keys(MAIL_TEMPLATE_HASHES).sort()).toEqual(
      MAIL_TEMPLATE_DEFINITIONS.map(({ key }) => key).sort(),
    );
    for (const template of defaults) {
      expect(MAIL_TEMPLATE_HASHES[template.key]).toContain(hashMailTemplateHtml(template.htmlTemplate));
    }
  });
});
