import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { GeneralInfoService } from './general-info.service';
import { UpdateGeneralInfoDto } from './dto/update-general-info.dto';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';
import { OrGuard } from '../auth/guards/or.guard';

@Controller('general-info')
export class GeneralInfoController {
  constructor(private readonly generalInfoService: GeneralInfoService) {}

  @Get()
  @UseGuards(OrGuard)
  getInfo() {
    return this.generalInfoService.getInfo();
  }

  @Patch()
  @UseGuards(JwtAdminGuard)
  updateInfo(@Body() dto: UpdateGeneralInfoDto) {
    return this.generalInfoService.updateInfo(dto);
  }
}
