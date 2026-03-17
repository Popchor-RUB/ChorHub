import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ChoirVoicesService } from './choir-voices.service';
import { CreateChoirVoiceDto, UpdateChoirVoiceDto } from './dto/choir-voice.dto';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';
import { Public } from '../auth/decorators/public.decorator';

@Controller('choir-voices')
export class ChoirVoicesController {
  constructor(private readonly choirVoicesService: ChoirVoicesService) {}

  @Get()
  @Public()
  findAll() {
    return this.choirVoicesService.findAll();
  }

  @Post()
  @UseGuards(JwtAdminGuard)
  create(@Body() dto: CreateChoirVoiceDto) {
    return this.choirVoicesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAdminGuard)
  update(@Param('id') id: string, @Body() dto: UpdateChoirVoiceDto) {
    return this.choirVoicesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAdminGuard)
  remove(@Param('id') id: string) {
    return this.choirVoicesService.remove(id);
  }
}
