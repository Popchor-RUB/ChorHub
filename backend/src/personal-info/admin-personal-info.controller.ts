import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';
import { PersonalInfoService } from './personal-info.service';
import type { PersonalInfoSendStatus } from './personal-info.service';
import { PublishPersonalInfoDto } from './dto/publish-personal-info.dto';
import { UpdatePersonalInfoEntryDto } from './dto/update-personal-info-entry.dto';

interface PublishFiles {
  recipients?: Express.Multer.File[];
  placeholderValues?: Express.Multer.File[];
}

@Controller('admin/personal-info')
@UseGuards(JwtAdminGuard)
export class AdminPersonalInfoController {
  constructor(private readonly personalInfoService: PersonalInfoService) {}

  @Get('config')
  getConfig() {
    return this.personalInfoService.getConfig();
  }

  @Get('send-status')
  getSendStatus(): PersonalInfoSendStatus {
    return this.personalInfoService.getSendStatus();
  }

  @Patch('config')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'recipients', maxCount: 1 },
      { name: 'placeholderValues', maxCount: 100 },
    ]),
  )
  publishConfig(
    @Body() dto: PublishPersonalInfoDto,
    @UploadedFiles() files: PublishFiles,
  ) {
    return this.personalInfoService.publish({
      markdownTemplate: dto.markdownTemplate,
      emailSubject: dto.emailSubject,
      sendEmail: dto.sendEmail === 'true',
      deleteNonTargetedEntries: dto.deleteNonTargetedEntries === 'true',
      recipientMode: dto.recipientMode,
      recipientFile: files.recipients?.[0],
      placeholderNamesJson: dto.placeholderNames,
      placeholderFiles: files.placeholderValues ?? [],
    });
  }

  @Get('members')
  listMembers() {
    return this.personalInfoService.listMemberRows();
  }

  @Get('members/:memberId')
  getMember(@Param('memberId') memberId: string) {
    return this.personalInfoService.getMemberRow(memberId);
  }

  @Patch('members/:memberId')
  updateMember(
    @Param('memberId') memberId: string,
    @Body() dto: UpdatePersonalInfoEntryDto,
  ) {
    return this.personalInfoService.upsertMemberInfo(memberId, dto.markdownContent);
  }
}
