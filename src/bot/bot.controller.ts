import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { BotService } from './bot.service';
import { CreateBotDto, UpdateBotDto } from './dto/bot.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('bots')
@UseGuards(JwtAuthGuard)
export class BotController {
  constructor(private botService: BotService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateBotDto) {
    return this.botService.create(userId, dto);
  }

  @Get()
  findAll(@CurrentUser('id') userId: string) {
    return this.botService.findAll(userId);
  }

  @Get('dashboard/overview')
  getDashboardOverview(@CurrentUser('id') userId: string) {
    return this.botService.getDashboardOverview(userId);
  }

  @Get(':id')
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.botService.findOne(userId, id);
  }

  @Put(':id')
  update(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: UpdateBotDto) {
    return this.botService.update(userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.botService.remove(userId, id);
  }
}
