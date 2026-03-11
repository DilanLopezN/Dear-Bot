import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('bots/:botId/conversations')
@UseGuards(JwtAuthGuard)
export class ConversationController {
  constructor(private service: ConversationService) {}

  @Get()
  findAll(@CurrentUser('id') userId: string, @Param('botId') botId: string) {
    return this.service.findAllByBot(userId, botId);
  }

  @Get(':conversationId/messages')
  getMessages(
    @Param('conversationId') conversationId: string,
    @Query('take') take?: string,
  ) {
    return this.service.getMessages(conversationId, take ? parseInt(take) : 50);
  }

  @Get(':conversationId/variables')
  getVariables(@Param('conversationId') conversationId: string) {
    return this.service.getVariables(conversationId);
  }
}
