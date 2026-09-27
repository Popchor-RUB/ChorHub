import { ConfigService } from '@nestjs/config';
import { mockDeep } from 'jest-mock-extended';
import type { Member, PrismaClient } from '../generated/prisma/client';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { MemberStatusService } from './member-status.service';

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

  it('disables once, revokes credentials, and persists both notices in one transaction', async () => {
    prisma.member.findUnique
      .mockResolvedValueOnce(member)
      .mockResolvedValueOnce({ ...member, isDisabled: true });
    prisma.member.updateMany.mockResolvedValue({ count: 1 });
    jest.spyOn(service, 'dispatchPendingNotices').mockResolvedValue();

    await service.disable(member.id, '  Admin decision  ');

    expect(prisma.member.updateMany).toHaveBeenCalledWith({
      where: { id: member.id, isDisabled: false },
      data: { isDisabled: true, disabledAt: expect.any(Date), disableReason: 'Admin decision' },
    });
    expect(prisma.memberLoginToken.deleteMany).toHaveBeenCalledWith({ where: { memberId: member.id } });
    expect(prisma.memberLoginCode.deleteMany).toHaveBeenCalledWith({ where: { memberId: member.id } });
    expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { memberId: member.id } });
    expect(prisma.memberDisableNotice.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ kind: 'MEMBER', recipient: member.email }),
        expect.objectContaining({ kind: 'ADMIN', recipient: 'admins@example.test' }),
      ]),
    });
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

  it('keeps failed notices pending for retry', async () => {
    prisma.memberDisableNotice.findMany.mockResolvedValue([{
      id: 'notice-1',
      memberId: member.id,
      kind: 'MEMBER',
      recipient: member.email,
      memberEmail: member.email,
      firstName: member.firstName,
      lastName: member.lastName,
      disableReason: null,
      internalComment: null,
      attempts: 0,
    }] as any);
    prisma.memberDisableNotice.updateMany.mockResolvedValue({ count: 1 });
    mail.sendMemberDisabledMail.mockRejectedValueOnce(new Error('SMTP unavailable'));

    await service.dispatchPendingNotices();

    expect(prisma.memberDisableNotice.update).toHaveBeenCalledWith({
      where: { id: 'notice-1' },
      data: expect.objectContaining({ attempts: 1, claimedAt: null, nextAttemptAt: expect.any(Date) }),
    });
  });
});
