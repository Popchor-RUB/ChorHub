import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminService } from './admin.service';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';

@Controller('admin')
@UseGuards(JwtAdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

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

  @Get('members/:id/history')
  getMemberHistory(@Param('id') id: string) {
    return this.adminService.getMemberHistory(id);
  }
}
