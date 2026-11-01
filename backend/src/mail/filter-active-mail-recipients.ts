import type { PrismaService } from '../prisma/prisma.service';
import { InvalidMailRecipientError } from '../common/invalid-mail-recipient.error';
import { requireSingleMailbox } from '../common/single-mailbox';
import type { MailTemplateKey } from './mail-template.types';

export async function filterActiveMailRecipients(
  prisma: PrismaService,
  template: MailTemplateKey,
  recipient: string,
  blindCopies?: string[],
) {
  const to = requireSingleMailbox(recipient);
  const bcc = blindCopies?.map(requireSingleMailbox);
  // Disable notices must reach the member after their account is disabled.
  if (template === 'member-disabled' || template === 'member-automatically-disabled' || template === 'admin-member-disabled') {
    return { to, bcc };
  }

  const members = await prisma.member.findMany({
    where: { isDisabled: true },
    select: { email: true },
  });
  const disabled = new Set(members.map(({ email }) => email.trim().toLowerCase()));
  if (disabled.has(to.toLowerCase())) {
    throw new InvalidMailRecipientError('Disabled members cannot receive email');
  }
  return { to, bcc: bcc?.filter((email) => !disabled.has(email.toLowerCase())) };
}
