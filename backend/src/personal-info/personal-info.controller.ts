import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth-user.types';
import { OrGuard } from '../auth/guards/or.guard';
import { PersonalInfoService } from './personal-info.service';

@Controller('personal-info')
export class PersonalInfoController {
  constructor(private readonly personalInfoService: PersonalInfoService) {}

  @Get('me')
  @UseGuards(OrGuard)
  async getMyPersonalInfo(@CurrentUser() user: AuthenticatedUser) {
    if (user.role !== 'member') {
      return {
        id: null,
        memberId: null,
        markdownContent: '',
        updatedAt: null,
      };
    }

    return this.personalInfoService.getMemberInfo(user.id);
  }
}
