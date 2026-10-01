import { ConfigService } from '@nestjs/config';
import { mockDeep } from 'jest-mock-extended';
import type { Member, MemberDisableNotice, PrismaClient } from '../generated/prisma/client';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { AUTOMATIC_DISABLE_REASON, MemberStatusService } from './member-status.service';

const member: Member = {
  id: 'member-1',
  firstName: 'Anna',
  lastName: 'Müller',
  email: 'anna@example.test',
  choirVoiceId: null,
  lastLoginAt: null,
  isDisabled: false,
  disabledAt: null,
  disableReason: null,
  internalComment: null,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
};

describe('MemberStatusService', () => {
  const prisma = mockDeep<PrismaService>();
  const config = mockDeep<ConfigService>();
  const mail = mockDeep<MailService>();
  let service: MemberStatusService;

  beforeEach(() => {
    jest.clearAllMocks();
    config.getOrThrow.mockReturnValue('admins@example.test');
    config.get.mockReturnValue('admins@example.test');
    prisma.$transaction.mockImplementation((callback: any) => callback(prisma as PrismaClient));
    service = new MemberStatusService(prisma, config, mail);
  });

  it.each([
    { automatic: false, reason: 'Admin decision', options: {}, memberNotice: true, shareReason: false },
    { automatic: false, reason: 'Admin decision', options: { notifyMember: false, includeReasonInEmail: true }, memberNotice: false, shareReason: false },
    { automatic: false, reason: 'Admin decision', options: { includeReasonInEmail: true }, memberNotice: true, shareReason: true },
    { automatic: false, reason: AUTOMATIC_DISABLE_REASON, options: { includeReasonInEmail: true }, memberNotice: true, shareReason: true },
    { automatic: false, reason: '   ', options: { includeReasonInEmail: true }, memberNotice: true, shareReason: false },
    { automatic: true, reason: 'ignored', options: { notifyMember: false, includeReasonInEmail: true }, memberNotice: true, shareReason: false },
  ])('disables and queues notices (automatic=$automatic, member notice=$memberNotice)', async ({ automatic, reason, options, memberNotice, shareReason }) => {
    prisma.member.findUnique
      .mockResolvedValueOnce(member)
      .mockResolvedValueOnce({ ...member, isDisabled: true });
    prisma.member.updateMany.mockResolvedValue({ count: 1 });
    jest.spyOn(service, 'dispatchPendingNotices').mockResolvedValue();

    await service.disable(member.id, ` ${reason} `, automatic, options);
    const storedReason = automatic ? AUTOMATIC_DISABLE_REASON : reason.trim() || null;

    expect(prisma.member.updateMany).toHaveBeenCalledWith({
      where: { id: member.id, isDisabled: false },
      data: { isDisabled: true, disabledAt: expect.any(Date), disableReason: storedReason },
    });
    expect(prisma.memberLoginToken.deleteMany).toHaveBeenCalledWith({ where: { memberId: member.id } });
    expect(prisma.memberLoginCode.deleteMany).toHaveBeenCalledWith({ where: { memberId: member.id } });
    expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { memberId: member.id } });
    expect(prisma.memberDisableNotice.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        ...(memberNotice ? [expect.objectContaining({
          kind: automatic ? 'MEMBER_AUTOMATIC' : 'MEMBER',
          recipient: member.email,
          disableReason: storedReason,
          includeReasonInEmail: shareReason,
        })] : []),
        expect.objectContaining({ kind: 'ADMIN', recipient: 'admins@example.test', disableReason: storedReason, includeReasonInEmail: false }),
      ]),
    });
    const notices = prisma.memberDisableNotice.createMany.mock.calls[0]?.[0]?.data;
    if (!Array.isArray(notices)) throw new Error('Expected queued notices');
    expect(notices).toHaveLength(memberNotice ? 2 : 1);
    if (!automatic && reason === AUTOMATIC_DISABLE_REASON) {
      expect(notices[0]).toMatchObject({ kind: 'MEMBER', includeReasonInEmail: true });
    }
  });

  it('does not revoke or duplicate notices when another worker won transition', async () => {
    prisma.member.findUnique.mockResolvedValue(member);
    prisma.member.updateMany.mockResolvedValue({ count: 0 });
    jest.spyOn(service, 'dispatchPendingNotices').mockResolvedValue();

    await service.disable(member.id, undefined, true);

    expect(prisma.memberLoginToken.deleteMany).not.toHaveBeenCalled();
    expect(prisma.memberDisableNotice.createMany).not.toHaveBeenCalled();
    expect(service.dispatchPendingNotices).not.toHaveBeenCalled();
  });

  it('reenables while retaining last reason and disable date', async () => {
    prisma.member.findUnique.mockResolvedValue({ ...member, isDisabled: false });

    await service.enable(member.id);

    expect(prisma.member.updateMany).toHaveBeenCalledWith({
      where: { id: member.id, isDisabled: true },
      data: { isDisabled: false },
    });
  });

  function pendingNotice(kind: string, disableReason: string | null = null, includeReasonInEmail = false): MemberDisableNotice {
    return {
      id: 'notice-1',
      memberId: member.id,
      kind,
      recipient: member.email,
      memberEmail: member.email,
      firstName: member.firstName,
      lastName: member.lastName,
      disableReason,
      includeReasonInEmail,
      attempts: 0,
      nextAttemptAt: new Date(),
      claimedAt: null,
      sentAt: null,
      lastError: null,
      createdAt: new Date(),
    };
  }

  it.each([
    { kind: 'MEMBER', automatic: false, reason: 'Secret reason', includeReasonInEmail: true, expectedReason: 'Secret reason' },
    { kind: 'MEMBER', automatic: false, reason: 'Legacy reason', includeReasonInEmail: false, expectedReason: '' },
    { kind: 'MEMBER_AUTOMATIC', automatic: true, reason: AUTOMATIC_DISABLE_REASON, includeReasonInEmail: true, expectedReason: '' },
  ])('dispatches $kind notice with safe reason visibility', async ({ kind, automatic, reason, includeReasonInEmail, expectedReason }) => {
    prisma.memberDisableNotice.findMany.mockResolvedValue([pendingNotice(kind, reason, includeReasonInEmail)]);
    prisma.memberDisableNotice.updateMany.mockResolvedValue({ count: 1 });

    await service.dispatchPendingNotices();

    expect(mail.sendMemberDisabledMail).toHaveBeenCalledWith({
      to: member.email,
      firstName: member.firstName,
      adminEmail: 'admins@example.test',
      automatic,
      reason: expectedReason,
    });
  });

  it('dispatches internal admin notice with full reason', async () => {
    prisma.memberDisableNotice.findMany.mockResolvedValue([{
      ...pendingNotice('ADMIN', 'Sensitive admin context'),
      recipient: 'admins@example.test',
    }]);
    prisma.memberDisableNotice.updateMany.mockResolvedValue({ count: 1 });

    await service.dispatchPendingNotices();

    expect(mail.sendAdminMemberDisabledMail).toHaveBeenCalledWith({
      to: 'admins@example.test',
      firstName: member.firstName,
      lastName: member.lastName,
      memberEmail: member.email,
      reason: 'Sensitive admin context',
    });
    expect(mail.sendMemberDisabledMail).not.toHaveBeenCalled();
  });

  it('keeps failed notices pending for retry with sharing choice persisted', async () => {
    prisma.memberDisableNotice.findMany
      .mockResolvedValueOnce([pendingNotice('MEMBER', 'Secret reason', true)])
      .mockResolvedValueOnce([pendingNotice('MEMBER', 'Secret reason', true)]);
    prisma.memberDisableNotice.updateMany.mockResolvedValue({ count: 1 });
    mail.sendMemberDisabledMail.mockRejectedValueOnce(new Error('SMTP unavailable'));

    await service.dispatchPendingNotices();

    expect(mail.sendMemberDisabledMail).toHaveBeenCalledWith(expect.objectContaining({ reason: 'Secret reason' }));

    expect(prisma.memberDisableNotice.update).toHaveBeenCalledWith({
      where: { id: 'notice-1' },
      data: expect.objectContaining({ attempts: 1, claimedAt: null, nextAttemptAt: expect.any(Date) }),
    });

    await service.dispatchPendingNotices();

    expect(mail.sendMemberDisabledMail).toHaveBeenNthCalledWith(2, expect.objectContaining({ reason: 'Secret reason' }));
    expect(prisma.memberDisableNotice.update).toHaveBeenLastCalledWith({
      where: { id: 'notice-1' },
      data: { sentAt: expect.any(Date), claimedAt: null, lastError: null },
    });
  });
});
