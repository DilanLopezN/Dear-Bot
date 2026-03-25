import { Module } from '@nestjs/common';
import { KeywordService } from './keyword.service';
import { KeywordController } from './keyword.controller';
import { KeywordAIService } from './keyword-ai.service';
import { BotModule } from '../bot/bot.module';
import { ServicesModule } from '../services/services.module';

@Module({
  imports: [BotModule, ServicesModule],
  controllers: [KeywordController],
  providers: [KeywordService, KeywordAIService],
  exports: [KeywordService, KeywordAIService],
})
export class KeywordModule {}
