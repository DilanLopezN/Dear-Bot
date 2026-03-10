import { Module } from '@nestjs/common';
import { Dialog360Service } from './dialog360.service';
import { ClaudeService } from './claude.service';
import { OpenAIService } from './openai.service';
import { GeminiService } from './gemini.service';

@Module({
  providers: [Dialog360Service, ClaudeService, OpenAIService, GeminiService],
  exports: [Dialog360Service, ClaudeService, OpenAIService, GeminiService],
})
export class ServicesModule {}
