import { Controller, Get, UseGuards } from '@nestjs/common';
import { MembersService } from './members.service';
import { MemberTokenGuard } from '../auth/guards/member-token.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { MemberUser } from '../auth/types/auth-user.types';

@Controller('members')
@UseGuards(MemberTokenGuard)
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get('me')
  async getMe(@CurrentUser() user: MemberUser) {
    return this.membersService.findById(user.id);
  }
}
