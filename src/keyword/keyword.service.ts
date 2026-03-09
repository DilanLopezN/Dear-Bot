import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BotService } from '../bot/bot.service';
import { CreateKeywordDto, UpdateKeywordDto } from './dto/keyword.dto';

@Injectable()
export class KeywordService {
  constructor(
    private prisma: PrismaService,
    private botService: BotService,
  ) {}

  async create(userId: string, botId: string, dto: CreateKeywordDto) {
    await this.botService.findOne(userId, botId);
    return this.prisma.keyword.create({
      data: { ...dto, botId },
    });
  }

  async findAll(userId: string, botId: string) {
    await this.botService.findOne(userId, botId);
    return this.prisma.keyword.findMany({
      where: { botId },
      orderBy: { priority: 'desc' },
    });
  }

  async update(userId: string, botId: string, keywordId: string, dto: UpdateKeywordDto) {
    await this.botService.findOne(userId, botId);
    const keyword = await this.prisma.keyword.findFirst({ where: { id: keywordId, botId } });
    if (!keyword) throw new NotFoundException('Keyword não encontrada');
    return this.prisma.keyword.update({ where: { id: keywordId }, data: dto });
  }

  async remove(userId: string, botId: string, keywordId: string) {
    await this.botService.findOne(userId, botId);
    return this.prisma.keyword.delete({ where: { id: keywordId } });
  }

  /** Busca resposta por keyword - usado internamente pelo webhook */
  async findMatch(botId: string, message: string): Promise<string | null> {
    const keywords = await this.prisma.keyword.findMany({
      where: { botId, isActive: true },
      orderBy: { priority: 'desc' },
    });

    const normalized = message.toLowerCase().trim();
    for (const kw of keywords) {
      if (normalized.includes(kw.trigger.toLowerCase())) {
        return kw.response;
      }
    }
    return null;
  }
}
