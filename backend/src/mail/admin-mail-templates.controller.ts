import { Body, Controller, Get, HttpCode, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';
import { MailTemplateService } from './mail-template.service';
import { PreviewMailTemplateDto } from './preview-mail-template.dto';
import { UpdateMailTemplateDto } from './update-mail-template.dto';

@Controller('admin/mail-templates')
@UseGuards(JwtAdminGuard)
export class AdminMailTemplatesController {
  constructor(private readonly mailTemplateService: MailTemplateService) {}

  @Get()
  list() {
    return this.mailTemplateService.list();
  }

  @Put(':key')
  update(@Param('key') key: string, @Body() dto: UpdateMailTemplateDto) {
    return this.mailTemplateService.update(key, dto);
  }

  @Post(':key/preview')
  @HttpCode(200)
  preview(@Param('key') key: string, @Body() dto: PreviewMailTemplateDto) {
    const { scenarioId, ...templates } = dto;
    return this.mailTemplateService.preview(key, templates, scenarioId);
  }
}
