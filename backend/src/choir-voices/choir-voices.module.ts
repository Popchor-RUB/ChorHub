import { Module } from '@nestjs/common';
import { ChoirVoicesService } from './choir-voices.service';
import { ChoirVoicesController } from './choir-voices.controller';

@Module({
  providers: [ChoirVoicesService],
  controllers: [ChoirVoicesController],
  exports: [ChoirVoicesService],
})
export class ChoirVoicesModule {}
