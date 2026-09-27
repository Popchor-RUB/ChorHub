import { Body, Controller, Get, Param, Put, UseGuards } from "@nestjs/common";
import { MemberTokenGuard } from "../auth/guards/member-token.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { MemberUser } from "../auth/types/auth-user.types";
import { SetAttendanceRecordDto } from "./dto/attendance.dto";
import { VoiceAdminAttendancePlanDto } from "./dto/voice-admin-attendance-plan.dto";
import { UpdateMemberCommentDto } from "../admin/dto/update-member-comment.dto";
import { VoiceAdminService } from "./voice-admin.service";

@Controller("attendance/voice-admin")
@UseGuards(MemberTokenGuard)
export class VoiceAdminController {
  constructor(private readonly voiceAdminService: VoiceAdminService) {}

  @Get("records/:rehearsalId")
  getRecords(
    @CurrentUser() user: MemberUser,
    @Param("rehearsalId") rehearsalId: string,
  ) {
    return this.voiceAdminService.getRecords(user.id, rehearsalId);
  }

  @Put("records/:rehearsalId")
  setRecord(
    @CurrentUser() user: MemberUser,
    @Param("rehearsalId") rehearsalId: string,
    @Body() dto: SetAttendanceRecordDto,
  ) {
    return this.voiceAdminService.setRecord(
      user.id,
      rehearsalId,
      dto.memberId,
      dto.attended,
    );
  }

  @Get("members/:memberId/rehearsals")
  getMemberRehearsals(
    @CurrentUser() user: MemberUser,
    @Param("memberId") memberId: string,
  ) {
    return this.voiceAdminService.getMemberRehearsals(user.id, memberId);
  }

  @Put("members/:memberId/attendance-plans/:rehearsalId")
  setMemberAttendancePlan(
    @CurrentUser() user: MemberUser,
    @Param("memberId") memberId: string,
    @Param("rehearsalId") rehearsalId: string,
    @Body() dto: VoiceAdminAttendancePlanDto,
  ) {
    return this.voiceAdminService.setMemberAttendancePlan(
      user.id,
      memberId,
      rehearsalId,
      dto.response,
    );
  }

  @Put("members/:memberId/comment")
  updateMemberComment(
    @CurrentUser() user: MemberUser,
    @Param("memberId") memberId: string,
    @Body() dto: UpdateMemberCommentDto,
  ) {
    return this.voiceAdminService.updateMemberComment(user.id, memberId, dto.comment);
  }

  @Get("checkin/public-key")
  getCheckinPublicKey(@CurrentUser() user: MemberUser) {
    return this.voiceAdminService.getCheckinPublicKey(user.id);
  }
}
