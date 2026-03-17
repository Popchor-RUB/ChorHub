import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
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
import { CreateMemberDto } from './dto/create-member.dto';

@Controller('admin')
@UseGuards(JwtAdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('members')
  createMember(@Body() dto: CreateMemberDto) {
    return this.adminService.createMember(dto);
  }

  @Post('members/import')
  @UseInterceptors(FileInterceptor('file'))
  async importMembers(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Keine Datei hochgeladen');
    return this.adminService.importMembersFromCsv(file.buffer);
  }

  @Get('members')
  getMemberOverview() {
    return this.adminService.getMemberOverview();
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

  @Delete('members/:id')
  @HttpCode(204)
  deleteMember(@Param('id') id: string) {
    return this.adminService.deleteMember(id);
  }

  @Get('members/:id/rehearsals')
  getMemberRehearsals(@Param('id') id: string) {
    return this.adminService.getMemberRehearsals(id);
  }

  @Get('members/:id/history')
  getMemberHistory(@Param('id') id: string) {
    return this.adminService.getMemberHistory(id);
  }
}
