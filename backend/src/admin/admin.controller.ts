import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Put,
  Query,
  Param,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminService } from './admin.service';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';
import { MEMBER_IMPORT_UPLOAD_OPTIONS } from '../common/multipart-upload-options';
import { CreateMemberDto } from './dto/create-member.dto';
import { AdminSetAttendancePlanDto } from './dto/admin-set-attendance-plan.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { MemberActivityStatsDto } from './dto/member-activity-stats.dto';
import { ReplaceVoiceAdminGrantsDto } from './dto/replace-voice-admin-grants.dto';
import { UpdateMemberStatusDto } from './dto/update-member-status.dto';
import { UpdateMemberCommentDto } from './dto/update-member-comment.dto';

@Controller('admin')
@UseGuards(JwtAdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('members')
  createMember(@Body() dto: CreateMemberDto) {
    return this.adminService.createMember(dto);
  }

  @Post('members/import')
  @UseInterceptors(FileInterceptor('file', MEMBER_IMPORT_UPLOAD_OPTIONS))
  async importMembers(
    @UploadedFile() file: Express.Multer.File,
    @Body('sendEmails') sendEmails: string,
  ) {
    if (!file) throw new BadRequestException('Keine Datei hochgeladen');
    return this.adminService.importMembersFromCsv(file.buffer, sendEmails === 'true');
  }

  @Get('members')
  getMemberOverview(@Query('status') status: 'active' | 'disabled' = 'active') {
    return this.adminService.getMemberOverview(status);
  }

  @Post('members/activity-stats')
  getMemberActivityStats(@Body() dto: MemberActivityStatsDto) {
    return this.adminService.getMemberActivityStats(dto.rehearsalIds);
  }

  @Get('members/search')
  searchMembers(@Query('q') query: string = '') {
    return this.adminService.searchMembers(query);
  }

  @Get('members/export')
  async exportMembers() {
    const buffer = await this.adminService.exportMembersExcel();
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="mitglieder-export.xlsx"',
    });
  }

  @Patch('members/:id/status')
  updateMemberStatus(@Param('id') id: string, @Body() dto: UpdateMemberStatusDto) {
    return this.adminService.updateMemberStatus(id, dto);
  }

  @Get('members/:id')
  getMember(@Param('id') id: string) {
    return this.adminService.getMemberById(id);
  }

  @Put('members/:id/comment')
  updateMemberComment(@Param('id') id: string, @Body() dto: UpdateMemberCommentDto) {
    return this.adminService.updateMemberComment(id, dto.comment);
  }

  @Put('members/:id/voice-admin-voices')
  replaceVoiceAdminVoices(@Param('id') id: string, @Body() dto: ReplaceVoiceAdminGrantsDto) {
    return this.adminService.replaceVoiceAdminVoices(id, dto.voiceIds);
  }

  @Patch('members/:id')
  updateMember(@Param('id') id: string, @Body() dto: UpdateMemberDto) {
    return this.adminService.updateMember(id, dto);
  }

  @Post('members/:id/send-invite')
  @HttpCode(204)
  sendMemberInvite(@Param('id') id: string) {
    return this.adminService.sendMemberInvite(id);
  }

  @Post('members/:id/send-login')
  @HttpCode(204)
  sendMemberLogin(@Param('id') id: string) {
    return this.adminService.sendMemberLoginEmail(id);
  }

  @Get('members/:id/rehearsals')
  getMemberRehearsals(@Param('id') id: string) {
    return this.adminService.getMemberRehearsals(id);
  }

  @Get('members/:id/history')
  getMemberHistory(@Param('id') id: string) {
    return this.adminService.getMemberHistory(id);
  }

  @Put('members/:memberId/attendance-plans/:rehearsalId')
  setMemberAttendancePlan(
    @Param('memberId') memberId: string,
    @Param('rehearsalId') rehearsalId: string,
    @Body() dto: AdminSetAttendancePlanDto,
  ) {
    return this.adminService.adminSetMemberAttendancePlan(memberId, rehearsalId, dto.response ?? null);
  }
}
