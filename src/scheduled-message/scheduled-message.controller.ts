import {
  Controller, Get, Post, Delete,
  Param, Body, Query, UseGuards, Request,
} from '@nestjs/common';
import { ScheduledMessageService } from './scheduled-message.service';
import { CreateScheduledMessageDto } from './dto/create-scheduled-message.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlanGuard } from '../common/guards/plan.guard';
import { RequirePlanFeature } from '../common/guards/plan.guard';

@UseGuards(JwtAuthGuard, PlanGuard)
@RequirePlanFeature('scheduled_messages')
@Controller('bots/:botId/scheduled-messages')
export class ScheduledMessageController {
  constructor(private readonly service: ScheduledMessageService) {}

  @Post()
  create(
    @Param('botId') botId: string,
    @Request() req: any,
    @Body() dto: CreateScheduledMessageDto,
  ) {
    return this.service.create(botId, req.user.userId, dto);
  }

  @Get()
  findAll(
    @Param('botId') botId: string,
    @Request() req: any,
    @Query('status') status?: string,
  ) {
    return this.service.findAll(botId, req.user.userId, status);
  }

  @Get(':id')
  findOne(@Param('botId') botId: string, @Request() req: any, @Param('id') id: string) {
    return this.service.findOne(botId, req.user.userId, id);
  }

  @Post(':id/cancel')
  cancel(@Param('botId') botId: string, @Request() req: any, @Param('id') id: string) {
    return this.service.cancel(botId, req.user.userId, id);
  }

  @Delete(':id')
  remove(@Param('botId') botId: string, @Request() req: any, @Param('id') id: string) {
    return this.service.remove(botId, req.user.userId, id);
  }
}
