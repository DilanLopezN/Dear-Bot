import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Logger } from '@nestjs/common';
import { KeywordService } from './keyword.service';
import { CreateKeywordDto, UpdateKeywordDto } from './dto/keyword.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { KeywordAIService } from './keyword-ai.service';

@Controller('bots/:botId/keywords')
@UseGuards(JwtAuthGuard)
export class KeywordController {
  private readonly logger = new Logger(KeywordController.name);

  constructor(
    private keywordService: KeywordService,
    private keywordAIService: KeywordAIService,
  ) {}

  @Post()
  create(
    @CurrentUser('id') userId: string,
    @Param('botId') botId: string,
    @Body() dto: CreateKeywordDto,
  ) {
    return this.keywordService.create(userId, botId, dto);
  }

  @Get()
  findAll(@CurrentUser('id') userId: string, @Param('botId') botId: string) {
    return this.keywordService.findAll(userId, botId);
  }

  @Put(':keywordId')
  update(
    @CurrentUser('id') userId: string,
    @Param('botId') botId: string,
    @Param('keywordId') keywordId: string,
    @Body() dto: UpdateKeywordDto,
  ) {
    return this.keywordService.update(userId, botId, keywordId, dto);
  }

  @Delete(':keywordId')
  remove(
    @CurrentUser('id') userId: string,
    @Param('botId') botId: string,
    @Param('keywordId') keywordId: string,
  ) {
    return this.keywordService.remove(userId, botId, keywordId);
  }

  /**
   * Gera variações de keyword usando I.A. baseado no trigger principal
   * POST /bots/:botId/keywords/:keywordId/ai-enhance
   */
  @Post(':keywordId/ai-enhance')
  async aiEnhance(
    @CurrentUser('id') userId: string,
    @Param('botId') botId: string,
    @Param('keywordId') keywordId: string,
  ) {
    this.logger.log(`AI enhance keyword ${keywordId} no bot ${botId}`);
    return this.keywordAIService.enhanceKeyword(userId, botId, keywordId);
  }
}
