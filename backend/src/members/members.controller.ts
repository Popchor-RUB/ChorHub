import { Controller, Get, UseGuards } from '@nestjs/common';
import { MembersService } from './members.service';
import { MemberTokenGuard } from '../auth/guards/member-token.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('members')
@UseGuards(MemberTokenGuard)
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get('me')
  async getMe(@CurrentUser() user: any) {
    return this.membersService.findById(user.id);
  }
}
