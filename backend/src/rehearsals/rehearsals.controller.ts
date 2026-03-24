import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RehearsalsService } from './rehearsals.service';
import { CreateRehearsalDto } from './dto/create-rehearsal.dto';
import { UpdateRehearsalDto } from './dto/update-rehearsal.dto';
import { MemberTokenGuard } from '../auth/guards/member-token.guard';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { MemberUser } from '../auth/types/auth-user.types';
import { Public } from '../auth/decorators/public.decorator';

@Controller('rehearsals')
export class RehearsalsController {
  constructor(private readonly rehearsalsService: RehearsalsService) {}

  @Public()
  @Get('calendar.ics')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header('Content-Disposition', 'inline; filename="chorhub-rehearsals.ics"')
  getMemberCalendar() {
    return this.rehearsalsService.getMemberCalendar();
  }

  @Get()
  @UseGuards(MemberTokenGuard)
  getForMember(
    @CurrentUser() user: MemberUser,
    @Query('all') all?: string,
  ) {
    if (all === 'true') {
      return this.rehearsalsService.findAllForMember(user.id);
    }
    return this.rehearsalsService.findUpcoming(user.id);
  }

  @Get('all')
  @UseGuards(JwtAdminGuard)
  getAll() {
    return this.rehearsalsService.findAll();
  }

  @Post()
  @UseGuards(JwtAdminGuard)
  create(@Body() dto: CreateRehearsalDto) {
    return this.rehearsalsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAdminGuard)
  update(@Param('id') id: string, @Body() dto: UpdateRehearsalDto) {
    return this.rehearsalsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAdminGuard)
  remove(@Param('id') id: string) {
    return this.rehearsalsService.remove(id);
  }
}
