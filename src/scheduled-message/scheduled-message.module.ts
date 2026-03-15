import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ScheduledMessageController } from './scheduled-message.controller';
import { ScheduledMessageService } from './scheduled-message.service';
import { ServicesModule } from '../services/services.module';

@Module({
  imports: [ScheduleModule.forRoot(), ServicesModule],
  controllers: [ScheduledMessageController],
  providers: [ScheduledMessageService],
  exports: [ScheduledMessageService],
})
export class ScheduledMessageModule {}
