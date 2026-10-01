import {
  appendMailTemplateHashes,
  findMissingMailTemplateHashes,
  formatMailTemplateHashRegistry,
} from './mail-template-hash-maintenance';

describe('mail template hash maintenance', () => {
  it('retains historical hashes and adds current hashes once', () => {
    const result = appendMailTemplateHashes(
      { invite: ['historical-hash', 'current-hash'] },
      [
        { key: 'invite', hash: 'current-hash' },
        { key: 'invite', hash: 'new-hash' },
        { key: 'new-template', hash: 'new-template-hash' },
      ],
    );

    expect(result).toEqual({
      invite: ['current-hash', 'historical-hash', 'new-hash'],
      'new-template': ['new-template-hash'],
    });
  });

  it('formats registry deterministically regardless of input order or duplicates', () => {
    const first = formatMailTemplateHashRegistry({
      invite: ['z-hash', 'a-hash', 'a-hash'],
      'magic-link': ['magic-hash'],
    });
    const second = formatMailTemplateHashRegistry({
      'magic-link': ['magic-hash'],
      invite: ['a-hash', 'z-hash'],
    });

    expect(first).toBe(second);
  });

  it('reports current hashes absent from registry', () => {
    expect(
      findMissingMailTemplateHashes(
        { invite: ['old-hash'] },
        [
          { key: 'invite', hash: 'current-hash' },
          { key: 'magic-link', hash: 'magic-hash' },
        ],
      ),
    ).toEqual([
      { key: 'invite', hash: 'current-hash' },
      { key: 'magic-link', hash: 'magic-hash' },
    ]);
  });
});
