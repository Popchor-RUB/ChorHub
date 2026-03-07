import { IsEnum, IsArray, IsString } from 'class-validator';
import { AttendanceResponse } from '../../generated/prisma/client';

export class SetAttendancePlanDto {
  @IsEnum(AttendanceResponse)
  response: AttendanceResponse;
}

export class BulkAttendanceRecordDto {
  @IsArray()
  @IsString({ each: true })
  memberIds: string[];
}
