import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BotService } from '../bot/bot.service';
import { CreateKeywordDto, UpdateKeywordDto } from './dto/keyword.dto';

export interface KeywordGoto {
  type: 'MENU' | 'KEYWORD';
  target: string;
}

export interface CaptureVariableConfig {
  name: string;
  type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'DATE';
  promptMessage: string;
}

export interface KeywordMatchResult {
  response: string;
  goto?: KeywordGoto;
  captureVariable?: CaptureVariableConfig;
}

@Injectable()
export class KeywordService {
  private readonly logger = new Logger(KeywordService.name);

  constructor(
    private prisma: PrismaService,
    private botService: BotService,
  ) {}

  async create(userId: string, botId: string, dto: CreateKeywordDto) {
    this.logger.log(`Criando keyword "${dto.trigger}" no bot ${botId}`);
    try {
      await this.botService.findOne(userId, botId);
      return await this.prisma.keyword.create({
        data: {
          botId,
          trigger: dto.trigger,
          response: dto.response,
          priority: dto.priority,
          goto: dto.goto ? (dto.goto as any) : undefined,
          captureVariable: dto.captureVariable ? (dto.captureVariable as any) : undefined,
        },
      });
    } catch (err) {
      this.logger.error(`Erro ao criar keyword no bot ${botId}`, err);
      throw err;
    }
  }

  async findAll(userId: string, botId: string) {
    await this.botService.findOne(userId, botId);
    return this.prisma.keyword.findMany({
      where: { botId },
      orderBy: { priority: 'desc' },
    });
  }

  async update(userId: string, botId: string, keywordId: string, dto: UpdateKeywordDto) {
    this.logger.log(`Atualizando keyword ${keywordId} no bot ${botId}`);
    try {
      await this.botService.findOne(userId, botId);
      const keyword = await this.prisma.keyword.findFirst({ where: { id: keywordId, botId } });
      if (!keyword) throw new NotFoundException('Keyword não encontrada');

      const { captureVariable, ...rest } = dto;
      return await this.prisma.keyword.update({
        where: { id: keywordId },
        data: {
          ...rest,
          goto: dto.goto === null ? null : dto.goto ? (dto.goto as any) : undefined,
          captureVariable: captureVariable === null ? null : captureVariable ? (captureVariable as any) : undefined,
        },
      });
    } catch (err) {
      this.logger.error(`Erro ao atualizar keyword ${keywordId}`, err);
      throw err;
    }
  }

  async remove(userId: string, botId: string, keywordId: string) {
    this.logger.log(`Removendo keyword ${keywordId} do bot ${botId}`);
    try {
      await this.botService.findOne(userId, botId);
      return await this.prisma.keyword.delete({ where: { id: keywordId } });
    } catch (err) {
      this.logger.error(`Erro ao remover keyword ${keywordId}`, err);
      throw err;
    }
  }

  async findByExactTrigger(botId: string, trigger: string) {
    return this.prisma.keyword.findFirst({
      where: {
        botId,
        isActive: true,
        trigger: { equals: trigger, mode: 'insensitive' },
      },
      orderBy: { priority: 'desc' },
    });
  }

  async findMatch(botId: string, message: string): Promise<KeywordMatchResult | null> {
    const keywords = await this.prisma.keyword.findMany({
      where: { botId, isActive: true },
      orderBy: { priority: 'desc' },
    });

    const normalized = message.toLowerCase().trim();
    for (const kw of keywords) {
      if (normalized.includes(kw.trigger.toLowerCase())) {
        return {
          response: kw.response,
          goto: kw.goto as unknown as KeywordGoto | undefined,
          captureVariable: kw.captureVariable as unknown as CaptureVariableConfig | undefined,
        };
      }
    }
    return null;
  }
}
