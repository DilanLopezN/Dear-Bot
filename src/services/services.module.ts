import { Module } from '@nestjs/common';
import { Dialog360Service } from './dialog360.service';
import { ClaudeService } from './claude.service';

@Module({
  providers: [Dialog360Service, ClaudeService],
  exports: [Dialog360Service, ClaudeService],
})
export class ServicesModule {}
