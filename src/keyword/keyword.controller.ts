import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { KeywordService } from './keyword.service';
import { CreateKeywordDto, UpdateKeywordDto } from './dto/keyword.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('bots/:botId/keywords')
@UseGuards(JwtAuthGuard)
export class KeywordController {
  constructor(private keywordService: KeywordService) {}

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
}
