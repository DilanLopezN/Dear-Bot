import { Module } from '@nestjs/common';
import { ChatManagementController } from './chat-management.controller';
import { ChatManagementService } from './chat-management.service';
import { ConversationModule } from '../conversation/conversation.module';
import { ServicesModule } from '../services/services.module';

@Module({
  imports: [ConversationModule, ServicesModule],
  controllers: [ChatManagementController],
  providers: [ChatManagementService],
})
export class ChatManagementModule {}
