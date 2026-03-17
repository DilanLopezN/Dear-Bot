import { Module } from '@nestjs/common';
import { IterationService } from './iteration.service';
import { IterationController } from './iteration.controller';
import { BotModule } from '../bot/bot.module';

@Module({
  imports: [BotModule],
  controllers: [IterationController],
  providers: [IterationService],
  exports: [IterationService],
})
export class IterationModule {}
