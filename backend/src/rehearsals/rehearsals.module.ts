import { Module } from '@nestjs/common';
import { RehearsalsService } from './rehearsals.service';
import { RehearsalsController } from './rehearsals.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [RehearsalsService],
  controllers: [RehearsalsController],
  exports: [RehearsalsService],
})
export class RehearsalsModule {}
