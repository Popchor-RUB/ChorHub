import { Body, Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { SetAttendancePlanDto, BulkAttendanceRecordDto } from './dto/attendance.dto';
import { MemberTokenGuard } from '../auth/guards/member-token.guard';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { MemberUser } from '../auth/types/auth-user.types';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Put('plans/:rehearsalId')
  @UseGuards(MemberTokenGuard)
  setAttendancePlan(
    @CurrentUser() user: MemberUser,
    @Param('rehearsalId') rehearsalId: string,
    @Body() dto: SetAttendancePlanDto,
  ) {
    return this.attendanceService.setAttendancePlan(user.id, rehearsalId, dto);
  }

  @Delete('plans/:rehearsalId')
  @UseGuards(MemberTokenGuard)
  deleteAttendancePlan(
    @CurrentUser() user: MemberUser,
    @Param('rehearsalId') rehearsalId: string,
  ) {
    return this.attendanceService.deleteAttendancePlan(user.id, rehearsalId);
  }

  @Get('records/:rehearsalId')
  @UseGuards(JwtAdminGuard)
  getRecords(@Param('rehearsalId') rehearsalId: string) {
    return this.attendanceService.getRecordsForRehearsal(rehearsalId);
  }

  @Put('records/:rehearsalId')
  @UseGuards(JwtAdminGuard)
  bulkSetRecords(
    @Param('rehearsalId') rehearsalId: string,
    @Body() dto: BulkAttendanceRecordDto,
  ) {
    return this.attendanceService.bulkSetAttendanceRecords(rehearsalId, dto.memberIds);
  }

  @Get('overview/future')
  @UseGuards(JwtAdminGuard)
  getFutureOverview() {
    return this.attendanceService.getFutureOverview();
  }

  @Get('overview/past')
  @UseGuards(JwtAdminGuard)
  getPastOverview() {
    return this.attendanceService.getPastOverview();
  }
}
