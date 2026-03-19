import { Module } from '@nestjs/common';
import { Dialog360Service } from './dialog360.service';
import { EvolutionService } from './evolution.service';
import { BaileysService } from './baileys.service';
import { MessagingService } from './messaging.service';
import { ClaudeService } from './claude.service';
import { OpenAIService } from './openai.service';
import { GeminiService } from './gemini.service';
import { AiLearningService } from './ai-learning.service';

@Module({
  providers: [Dialog360Service, EvolutionService, BaileysService, MessagingService, ClaudeService, OpenAIService, GeminiService, AiLearningService],
  exports: [Dialog360Service, EvolutionService, BaileysService, MessagingService, ClaudeService, OpenAIService, GeminiService, AiLearningService],
})
export class ServicesModule {}
