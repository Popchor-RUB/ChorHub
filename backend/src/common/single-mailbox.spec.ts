import { InvalidMailRecipientError } from './invalid-mail-recipient.error';
import { normalizeSingleMailbox, requireSingleMailbox } from './single-mailbox';

describe('single mailbox validation', () => {
  it.each([
    ['  Anna+choir@Example.TEST  ', 'anna+choir@example.test'],
    ["o'connor@example.test", "o'connor@example.test"],
    ['müller@example.test', 'müller@example.test'],
  ])('normalizes valid mailbox %s', (input, expected) => {
    expect(normalizeSingleMailbox(input)).toBe(expected);
    expect(requireSingleMailbox(input)).toBe(expected);
  });

  it.each([
    'member@example.test,external@example.test',
    'member@example.test;external@example.test',
    'Choir: member@example.test,external@example.test;',
    'Anna <member@example.test>',
    '<member@example.test>',
    'member@example.test (Anna)',
    'member@example.test\r\nBcc: external@example.test',
    '\r\nmember@example.test',
    'member@example.test\n',
    'member\u0000@example.test',
    '"member,external"@example.test',
    '"member\\""@example.test',
    'not-an-email',
    'member@',
    '',
    '   ',
    null,
    undefined,
    ['member@example.test'],
  ])('rejects malformed or structured recipient %p', (input) => {
    expect(normalizeSingleMailbox(input)).toBeNull();
    expect(() => requireSingleMailbox(input)).toThrow(InvalidMailRecipientError);
  });
});
