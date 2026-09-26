import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AttendanceService } from "./attendance.service";
import { CheckinService } from "../checkin/checkin.service";
import { AdminService } from "../admin/admin.service";

@Injectable()
export class VoiceAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceService: AttendanceService,
    private readonly checkinService: CheckinService,
    private readonly adminService: AdminService,
  ) {}

  async getRecords(memberId: string, rehearsalId: string) {
    const voiceIds = await this.requireVoiceIds(memberId);
    return this.attendanceService.getVoiceAdminRecordsForRehearsal(
      rehearsalId,
      voiceIds,
    );
  }

  async setRecord(
    memberId: string,
    rehearsalId: string,
    targetMemberId: string,
    attended: boolean,
  ) {
    const voiceIds = await this.requireVoiceIds(memberId);
    await this.requireTargetMemberVoice(targetMemberId, voiceIds);
    return this.attendanceService.setAttendanceRecord(
      rehearsalId,
      targetMemberId,
      attended,
    );
  }

  async getMemberRehearsals(memberId: string, targetMemberId: string) {
    const voiceIds = await this.requireVoiceIds(memberId);
    await this.requireTargetMemberVoice(targetMemberId, voiceIds);
    return this.adminService.getMemberRehearsals(targetMemberId);
  }

  async setMemberAttendancePlan(
    memberId: string,
    targetMemberId: string,
    rehearsalId: string,
    response: "CONFIRMED" | "DECLINED" | null,
  ) {
    const voiceIds = await this.requireVoiceIds(memberId);
    await this.requireTargetMemberVoice(targetMemberId, voiceIds);
    return this.adminService.adminSetMemberAttendancePlan(
      targetMemberId,
      rehearsalId,
      response,
    );
  }

  async getCheckinPublicKey(memberId: string) {
    await this.requireVoiceIds(memberId);
    return { publicKey: this.checkinService.getPublicKeyBase64() };
  }

  private async requireVoiceIds(memberId: string): Promise<string[]> {
    const grants = await this.prisma.voiceAdminGrant.findMany({
      where: { memberId },
      select: { choirVoiceId: true },
    });
    if (grants.length === 0)
      throw new ForbiddenException("Keine Stimmlagen freigegeben");
    return grants.map((grant) => grant.choirVoiceId);
  }

  private async requireTargetMemberVoice(memberId: string, voiceIds: string[]) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      select: { id: true, choirVoiceId: true },
    });
    if (!member?.choirVoiceId || !voiceIds.includes(member.choirVoiceId)) {
      throw new ForbiddenException(
        "Mitglied liegt außerhalb der freigegebenen Stimmlagen",
      );
    }
    return member;
  }
}
