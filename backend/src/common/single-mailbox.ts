import { isEmail } from 'class-validator';
import { InvalidMailRecipientError } from './invalid-mail-recipient.error';

/** Accept only bare mailboxes, never address lists, groups or display names. */
export function normalizeSingleMailbox(value: unknown): string | null {
  // Reject controls before trimming so CR/LF cannot disappear during normalization.
  // eslint-disable-next-line no-control-regex
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f-\u009f]/u.test(value)) return null;

  const email = value.trim().toLowerCase();
  if (/[\s,;:<>()"\\]/u.test(email) || !isEmail(email)) return null;
  return email;
}

export function requireSingleMailbox(value: unknown): string {
  const email = normalizeSingleMailbox(value);
  if (!email) throw new InvalidMailRecipientError();
  return email;
}
