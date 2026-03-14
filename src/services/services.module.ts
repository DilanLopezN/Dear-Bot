import { Module } from '@nestjs/common';
import { Dialog360Service } from './dialog360.service';
import { EvolutionService } from './evolution.service';
import { MessagingService } from './messaging.service';
import { ClaudeService } from './claude.service';
import { OpenAIService } from './openai.service';
import { GeminiService } from './gemini.service';

@Module({
  providers: [Dialog360Service, EvolutionService, MessagingService, ClaudeService, OpenAIService, GeminiService],
  exports: [Dialog360Service, EvolutionService, MessagingService, ClaudeService, OpenAIService, GeminiService],
})
export class ServicesModule {}
