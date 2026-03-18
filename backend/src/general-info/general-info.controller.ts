import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { GeneralInfoService } from './general-info.service';
import { UpdateGeneralInfoDto } from './dto/update-general-info.dto';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';
import { OrGuard } from '../auth/guards/or.guard';
import { PushService } from '../push/push.service';

@Controller('general-info')
export class GeneralInfoController {
  constructor(
    private readonly generalInfoService: GeneralInfoService,
    private readonly pushService: PushService,
  ) {}

  @Get()
  @UseGuards(OrGuard)
  getInfo() {
    return this.generalInfoService.getInfo();
  }

  @Patch()
  @UseGuards(JwtAdminGuard)
  async updateInfo(@Body() dto: UpdateGeneralInfoDto) {
    const result = await this.generalInfoService.updateInfo(dto);
    if (dto.sendPushNotification) {
      await this.pushService.sendToAll({
        title: 'Neue Informationen',
        body: 'Informationen wurden aktualisiert!',
        url: '/informationen',
      });
    }
    return result;
  }
}
