import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { IsString, IsOptional } from 'class-validator';
import { MembersService } from './members.service';
import { MemberTokenGuard } from '../auth/guards/member-token.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { MemberUser } from '../auth/types/auth-user.types';

class UpdateVoiceDto {
  @IsOptional()
  @IsString()
  voiceId: string | null;
}

@Controller('members')
@UseGuards(MemberTokenGuard)
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get('me')
  async getMe(@CurrentUser() user: MemberUser) {
    return this.membersService.findById(user.id);
  }

  @Patch('me/voice')
  async updateVoice(@CurrentUser() user: MemberUser, @Body() body: UpdateVoiceDto) {
    return this.membersService.updateVoice(user.id, body.voiceId ?? null);
  }
}
