import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BroadcastController } from './broadcast.controller';
import { BroadcastService } from './broadcast.service';
import { ServicesModule } from '../services/services.module';

@Module({
  imports: [ScheduleModule.forRoot(), ServicesModule],
  controllers: [BroadcastController],
  providers: [BroadcastService],
  exports: [BroadcastService],
})
export class BroadcastModule {}
