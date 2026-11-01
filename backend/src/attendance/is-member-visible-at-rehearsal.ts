import type { Member } from '../generated/prisma/client';

export function isMemberVisibleAtRehearsal(
  member: Pick<Member, 'isDisabled' | 'disabledAt'>,
  rehearsalDate: Date,
): boolean {
  return !member.isDisabled || (
    rehearsalDate.getTime() <= Date.now()
    && member.disabledAt !== null
    && member.disabledAt > rehearsalDate
  );
}
