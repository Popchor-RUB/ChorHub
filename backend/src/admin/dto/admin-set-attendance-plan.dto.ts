import { IsEnum, IsOptional } from 'class-validator';
import { AttendanceResponse } from '../../generated/prisma/client';

export class AdminSetAttendancePlanDto {
  @IsOptional()
  @IsEnum(AttendanceResponse)
  response: AttendanceResponse | null;
}
