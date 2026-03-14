import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ChatManagementService } from './chat-management.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('chats')
@UseGuards(JwtAuthGuard)
export class ChatManagementController {
  constructor(private service: ChatManagementService) {}

  @Get()
  listChats(
    @CurrentUser('id') userId: string,
    @Query('botId') botId?: string,
    @Query('minWaitMinutes') minWaitMinutes?: string,
    @Query('status') status?: string,
  ) {
    return this.service.listChats(userId, {
      botId,
      minWaitMinutes: minWaitMinutes ? parseInt(minWaitMinutes) : undefined,
      status,
    });
  }

  @Get(':conversationId/messages')
  getMessages(
    @CurrentUser('id') userId: string,
    @Param('conversationId') conversationId: string,
    @Query('take') take?: string,
  ) {
    return this.service.getMessages(userId, conversationId, take ? parseInt(take) : 100);
  }

  @Post(':conversationId/takeover')
  takeover(
    @CurrentUser('id') userId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.service.takeoverChat(userId, conversationId);
  }

  @Post(':conversationId/release')
  release(
    @CurrentUser('id') userId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.service.releaseChat(userId, conversationId);
  }

  @Post(':conversationId/send')
  sendMessage(
    @CurrentUser('id') userId: string,
    @Param('conversationId') conversationId: string,
    @Body('content') content: string,
  ) {
    return this.service.sendMessage(userId, conversationId, content);
  }
}
