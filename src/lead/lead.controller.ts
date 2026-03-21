import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, UseGuards, Request,
} from '@nestjs/common';
import { LeadService } from './lead.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlanGuard } from '../common/guards/plan.guard';
import { RequirePlanFeature } from '../common/guards/plan.guard';

@UseGuards(JwtAuthGuard, PlanGuard)
@RequirePlanFeature('leads')
@Controller('bots/:botId/leads')
export class LeadController {
  constructor(private readonly leadService: LeadService) {}

  @Post()
  create(@Param('botId') botId: string, @Request() req: any, @Body() dto: CreateLeadDto) {
    return this.leadService.create(botId, req.user.userId, dto);
  }

  @Get('stats')
  getStats(@Param('botId') botId: string, @Request() req: any) {
    return this.leadService.getStats(botId, req.user.userId);
  }

  @Post('sync')
  syncAll(@Param('botId') botId: string, @Request() req: any) {
    return this.leadService.syncAllContacts(botId, req.user.userId);
  }

  @Get()
  findAll(
    @Param('botId') botId: string,
    @Request() req: any,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('temperature') temperature?: string,
    @Query('sortBy') sortBy?: string,
  ) {
    return this.leadService.findAll(botId, req.user.userId, {
      search,
      status,
      temperature,
      sortBy,
    });
  }

  @Get(':id')
  findOne(@Param('botId') botId: string, @Request() req: any, @Param('id') id: string) {
    return this.leadService.findOne(botId, req.user.userId, id);
  }

  @Put(':id')
  update(
    @Param('botId') botId: string,
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leadService.update(botId, req.user.userId, id, dto);
  }

  @Delete(':id')
  remove(@Param('botId') botId: string, @Request() req: any, @Param('id') id: string) {
    return this.leadService.remove(botId, req.user.userId, id);
  }

  @Post(':id/recalculate')
  recalculate(@Param('botId') botId: string, @Request() req: any, @Param('id') id: string) {
    return this.leadService.findOne(botId, req.user.userId, id).then(async (lead) => {
      await this.leadService.recalculateScore(lead.id);
      return this.leadService.findOne(botId, req.user.userId, id);
    });
  }
}
