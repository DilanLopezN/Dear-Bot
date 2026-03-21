import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { IterationService } from './iteration.service';
import { CreateIterationDto, UpdateIterationDto } from './dto/iteration.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlanGuard } from '../common/guards/plan.guard';
import { RequirePlanFeature } from '../common/guards/plan.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('bots/:botId/iterations')
@UseGuards(JwtAuthGuard, PlanGuard)
@RequirePlanFeature('ai_iterations')
export class IterationController {
  constructor(private iterationService: IterationService) {}

  @Post()
  create(
    @CurrentUser('id') userId: string,
    @Param('botId') botId: string,
    @Body() dto: CreateIterationDto,
  ) {
    return this.iterationService.create(userId, botId, dto);
  }

  @Get()
  findAll(@CurrentUser('id') userId: string, @Param('botId') botId: string) {
    return this.iterationService.findAll(userId, botId);
  }

  @Get(':iterationId')
  findOne(
    @CurrentUser('id') userId: string,
    @Param('botId') botId: string,
    @Param('iterationId') iterationId: string,
  ) {
    return this.iterationService.findOne(userId, botId, iterationId);
  }

  @Put(':iterationId')
  update(
    @CurrentUser('id') userId: string,
    @Param('botId') botId: string,
    @Param('iterationId') iterationId: string,
    @Body() dto: UpdateIterationDto,
  ) {
    return this.iterationService.update(userId, botId, iterationId, dto);
  }

  @Delete(':iterationId')
  remove(
    @CurrentUser('id') userId: string,
    @Param('botId') botId: string,
    @Param('iterationId') iterationId: string,
  ) {
    return this.iterationService.remove(userId, botId, iterationId);
  }
}
