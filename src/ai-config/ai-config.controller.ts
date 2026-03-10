import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AiConfigService } from './ai-config.service';
import { CreateAiConfigDto, UpdateAiConfigDto } from './dto/ai-config.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('ai-configs')
@UseGuards(JwtAuthGuard)
export class AiConfigController {
  constructor(private aiConfigService: AiConfigService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateAiConfigDto) {
    return this.aiConfigService.create(userId, dto);
  }

  @Get()
  findAll(@CurrentUser('id') userId: string) {
    return this.aiConfigService.findAll(userId);
  }

  @Get(':id')
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.aiConfigService.findOne(userId, id);
  }

  @Put(':id')
  update(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: UpdateAiConfigDto) {
    return this.aiConfigService.update(userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.aiConfigService.remove(userId, id);
  }
}
