import {
  Controller, Get, Post, Put, Delete,
  Param, Body, UseGuards, Request,
} from '@nestjs/common';
import { BroadcastService } from './broadcast.service';
import { CreateBroadcastListDto, UpdateBroadcastListDto } from './dto/create-broadcast-list.dto';
import { CreateBroadcastDto } from './dto/create-broadcast.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlanGuard } from '../common/guards/plan.guard';
import { RequirePlanFeature } from '../common/guards/plan.guard';

@UseGuards(JwtAuthGuard, PlanGuard)
@RequirePlanFeature('broadcast_lists', 'broadcasts')
@Controller('bots/:botId')
export class BroadcastController {
  constructor(private readonly service: BroadcastService) {}

  // ─── Listas ───────────────────────────────────────────────────────────────

  @Post('broadcast-lists')
  createList(
    @Param('botId') botId: string,
    @Request() req: any,
    @Body() dto: CreateBroadcastListDto,
  ) {
    return this.service.createList(botId, req.user.userId, dto);
  }

  @Get('broadcast-lists')
  findAllLists(@Param('botId') botId: string, @Request() req: any) {
    return this.service.findAllLists(botId, req.user.userId);
  }

  @Get('broadcast-lists/:id')
  findOneList(@Param('botId') botId: string, @Request() req: any, @Param('id') id: string) {
    return this.service.findOneList(botId, req.user.userId, id);
  }

  @Put('broadcast-lists/:id')
  updateList(
    @Param('botId') botId: string,
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateBroadcastListDto,
  ) {
    return this.service.updateList(botId, req.user.userId, id, dto);
  }

  @Delete('broadcast-lists/:id')
  removeList(@Param('botId') botId: string, @Request() req: any, @Param('id') id: string) {
    return this.service.removeList(botId, req.user.userId, id);
  }

  // ─── Broadcasts ───────────────────────────────────────────────────────────

  @Post('broadcasts')
  createBroadcast(
    @Param('botId') botId: string,
    @Request() req: any,
    @Body() dto: CreateBroadcastDto,
  ) {
    return this.service.createBroadcast(botId, req.user.userId, dto);
  }

  @Get('broadcasts')
  findAllBroadcasts(@Param('botId') botId: string, @Request() req: any) {
    return this.service.findAllBroadcasts(botId, req.user.userId);
  }

  @Get('broadcasts/:id')
  findOneBroadcast(@Param('botId') botId: string, @Request() req: any, @Param('id') id: string) {
    return this.service.findOneBroadcast(botId, req.user.userId, id);
  }

  @Post('broadcasts/:id/send')
  sendNow(@Param('botId') botId: string, @Request() req: any, @Param('id') id: string) {
    return this.service.sendBroadcastNow(botId, req.user.userId, id);
  }

  @Post('broadcasts/:id/cancel')
  cancel(@Param('botId') botId: string, @Request() req: any, @Param('id') id: string) {
    return this.service.cancelBroadcast(botId, req.user.userId, id);
  }

  @Delete('broadcasts/:id')
  removeBroadcast(@Param('botId') botId: string, @Request() req: any, @Param('id') id: string) {
    return this.service.removeBroadcast(botId, req.user.userId, id);
  }
}
