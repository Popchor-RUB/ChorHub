import { IsEnum, IsBoolean, IsString } from 'class-validator';
import { AttendanceResponse } from '../../generated/prisma/client';

export class SetAttendancePlanDto {
  @IsEnum(AttendanceResponse)
  response: AttendanceResponse;
}

export class SetAttendanceRecordDto {
  @IsString()
  memberId: string;

  @IsBoolean()
  attended: boolean;
}
