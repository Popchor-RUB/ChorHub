import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RehearsalsService } from './rehearsals.service';
import { CreateRehearsalDto } from './dto/create-rehearsal.dto';
import { UpdateRehearsalDto } from './dto/update-rehearsal.dto';
import { MemberTokenGuard } from '../auth/guards/member-token.guard';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('rehearsals')
export class RehearsalsController {
  constructor(private readonly rehearsalsService: RehearsalsService) {}

  @Get()
  @UseGuards(MemberTokenGuard)
  getUpcoming(@CurrentUser() user: any) {
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
