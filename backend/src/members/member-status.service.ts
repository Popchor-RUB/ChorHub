import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

export const AUTOMATIC_DISABLE_REASON = 'Automatisch deaktiviert: drei unentschuldigte Fehlzeiten.';

export interface ManualDisableOptions {
  notifyMember?: boolean;
  includeReasonInEmail?: boolean;
}

@Injectable()
export class MemberStatusService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(MemberStatusService.name);
  private pendingNoticeDispatch: Promise<void> | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get<string>('CHOIR_ADMIN_EMAIL')?.trim()) {
      throw new Error('CHOIR_ADMIN_EMAIL must be configured');
    }
    void this.dispatchPendingNotices().catch((error: unknown) => {
      this.logger.error(`Unable to dispatch pending member notices: ${String(error)}`);
    });
  }

  async disable(
    memberId: string,
    reason: string | undefined,
    automatic = false,
    options: ManualDisableOptions = {},
  ) {
    const member = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!member) return null;
    if (member.isDisabled) return member;

    const disableReason = automatic
      ? AUTOMATIC_DISABLE_REASON
      : reason?.trim() || null;
    const notifyMember = automatic || (options.notifyMember ?? true);
    const includeReasonInEmail = !automatic && notifyMember && (options.includeReasonInEmail ?? false) && Boolean(disableReason);
    const now = new Date();
    const adminEmail = this.config.getOrThrow<string>('CHOIR_ADMIN_EMAIL');

    const changed = await this.prisma.$transaction(async (tx) => {
      const result = await tx.member.updateMany({
        where: { id: memberId, isDisabled: false },
        data: { isDisabled: true, disabledAt: now, disableReason },
      });
      if (result.count !== 1) return false;

      await tx.memberLoginToken.deleteMany({ where: { memberId } });
      await tx.memberLoginCode.deleteMany({ where: { memberId } });
      await tx.pushSubscription.deleteMany({ where: { memberId } });
      await tx.memberDisableNotice.createMany({
        data: [
          ...(notifyMember ? [{ memberId, kind: automatic ? 'MEMBER_AUTOMATIC' : 'MEMBER', recipient: member.email, memberEmail: member.email, firstName: member.firstName, lastName: member.lastName, disableReason, includeReasonInEmail }] : []),
          { memberId, kind: 'ADMIN', recipient: adminEmail, memberEmail: member.email, firstName: member.firstName, lastName: member.lastName, disableReason, includeReasonInEmail: false },
        ],
      });
      return true;
    });

    const updated = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (changed) {
      void this.dispatchPendingNotices().catch((error: unknown) => {
        this.logger.error(`Unable to dispatch member notices: ${String(error)}`);
      });
    }
    return updated;
  }

  async enable(memberId: string) {
    await this.prisma.member.updateMany({
      where: { id: memberId, isDisabled: true },
      data: { isDisabled: false },
    });
    return this.prisma.member.findUnique({ where: { id: memberId } });
  }

  @Cron('*/30 * * * * *')
  dispatchPendingNotices(): Promise<void> {
    this.pendingNoticeDispatch ??= this.deliverPendingNotices().finally(() => {
      this.pendingNoticeDispatch = undefined;
    });
    return this.pendingNoticeDispatch;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pendingNoticeDispatch;
  }

  private async deliverPendingNotices(): Promise<void> {
    const now = new Date();
    const expiredClaim = new Date(now.getTime() - 5 * 60_000);
    const notices = await this.prisma.memberDisableNotice.findMany({
      where: {
        sentAt: null,
        nextAttemptAt: { lte: now },
        OR: [{ claimedAt: null }, { claimedAt: { lt: expiredClaim } }],
      },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    for (const notice of notices) {
      const claim = await this.prisma.memberDisableNotice.updateMany({
        where: {
          id: notice.id,
          sentAt: null,
          OR: [{ claimedAt: null }, { claimedAt: { lt: expiredClaim } }],
        },
        data: { claimedAt: now },
      });
      if (claim.count !== 1) continue;

      try {
        if (notice.kind === 'MEMBER' || notice.kind === 'MEMBER_AUTOMATIC') {
          await this.mailService.sendMemberDisabledMail({
            to: notice.recipient,
            firstName: notice.firstName,
            adminEmail: this.config.getOrThrow<string>('CHOIR_ADMIN_EMAIL'),
            automatic: notice.kind === 'MEMBER_AUTOMATIC',
            reason: notice.kind === 'MEMBER' && notice.includeReasonInEmail ? notice.disableReason ?? '' : '',
          });
        } else {
          await this.mailService.sendAdminMemberDisabledMail({
            to: notice.recipient,
            firstName: notice.firstName,
            lastName: notice.lastName,
            memberEmail: notice.memberEmail,
            reason: notice.disableReason,
          });
        }
        await this.prisma.memberDisableNotice.update({
          where: { id: notice.id },
          data: { sentAt: new Date(), claimedAt: null, lastError: null },
        });
      } catch (error) {
        const attempts = notice.attempts + 1;
        const delayMs = Math.min(60 * 60_000, 30_000 * 2 ** Math.min(attempts, 7));
        this.logger.warn(`Member disable notice ${notice.id} failed: ${String(error)}`);
        await this.prisma.memberDisableNotice.update({
          where: { id: notice.id },
          data: {
            attempts,
            nextAttemptAt: new Date(Date.now() + delayMs),
            claimedAt: null,
            lastError: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }
  }
}
