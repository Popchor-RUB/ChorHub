import { IsIn } from "class-validator";
import { AttendanceResponse } from "../../generated/prisma/client";

export class VoiceAdminAttendancePlanDto {
  @IsIn([AttendanceResponse.CONFIRMED, AttendanceResponse.DECLINED, null])
  response: AttendanceResponse | null;
}
