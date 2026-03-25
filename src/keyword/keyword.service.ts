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
  matchedTrigger?: string;
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

      // Se triggers não foi fornecido, usar [trigger] como lista padrão
      const triggers = dto.triggers && dto.triggers.length > 0
        ? dto.triggers
        : [dto.trigger];

      return await this.prisma.keyword.create({
        data: {
          botId,
          trigger: dto.trigger,
          triggers,
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

      const { captureVariable, triggers, ...rest } = dto;

      // Se trigger principal mudou e triggers não foi fornecido, atualizar triggers também
      const updateData: any = {
        ...rest,
        goto: dto.goto === null ? null : dto.goto ? (dto.goto as any) : undefined,
        captureVariable: captureVariable === null ? null : captureVariable ? (captureVariable as any) : undefined,
      };

      if (triggers !== undefined) {
        updateData.triggers = triggers;
      }

      return await this.prisma.keyword.update({
        where: { id: keywordId },
        data: updateData,
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
    // Primeiro tenta match exato pelo trigger principal
    const exactMatch = await this.prisma.keyword.findFirst({
      where: {
        botId,
        isActive: true,
        trigger: { equals: trigger, mode: 'insensitive' },
      },
      orderBy: { priority: 'desc' },
    });
    if (exactMatch) return exactMatch;

    // Se não encontrou, busca nas listas de triggers
    const allKeywords = await this.prisma.keyword.findMany({
      where: { botId, isActive: true },
      orderBy: { priority: 'desc' },
    });

    const normalizedTrigger = trigger.toLowerCase().trim();
    for (const kw of allKeywords) {
      if (kw.triggers && kw.triggers.length > 0) {
        const found = kw.triggers.some(t => t.toLowerCase().trim() === normalizedTrigger);
        if (found) return kw;
      }
    }

    return null;
  }

  async findMatch(botId: string, message: string): Promise<KeywordMatchResult | null> {
    const keywords = await this.prisma.keyword.findMany({
      where: { botId, isActive: true },
      orderBy: { priority: 'desc' },
    });

    const normalized = message.toLowerCase().trim();
    for (const kw of keywords) {
      // Verificar nas triggers (lista de variações)
      const allTriggers = kw.triggers && kw.triggers.length > 0
        ? kw.triggers
        : [kw.trigger];

      for (const trigger of allTriggers) {
        if (normalized.includes(trigger.toLowerCase())) {
          return {
            response: kw.response,
            goto: kw.goto as unknown as KeywordGoto | undefined,
            captureVariable: kw.captureVariable as unknown as CaptureVariableConfig | undefined,
            matchedTrigger: trigger,
          };
        }
      }
    }
    return null;
  }

  /**
   * Busca por match similar usando IA - para modos AI e HYBRID
   * Retorna a keyword mais provável baseada na mensagem do usuário
   */
  async findSimilarMatch(botId: string, message: string, aiMatchFn: (message: string, keywords: Array<{ trigger: string; triggers: string[] }>) => Promise<string | null>): Promise<KeywordMatchResult | null> {
    const keywords = await this.prisma.keyword.findMany({
      where: { botId, isActive: true },
      orderBy: { priority: 'desc' },
    });

    if (!keywords.length) return null;

    const keywordList = keywords.map(kw => ({
      trigger: kw.trigger,
      triggers: kw.triggers && kw.triggers.length > 0 ? kw.triggers : [kw.trigger],
    }));

    const matchedTrigger = await aiMatchFn(message, keywordList);
    if (!matchedTrigger) return null;

    // Encontrar a keyword correspondente
    const matchedKw = keywords.find(kw => {
      const allTriggers = kw.triggers && kw.triggers.length > 0 ? kw.triggers : [kw.trigger];
      return kw.trigger.toLowerCase() === matchedTrigger.toLowerCase() ||
        allTriggers.some(t => t.toLowerCase() === matchedTrigger.toLowerCase());
    });

    if (!matchedKw) return null;

    return {
      response: matchedKw.response,
      goto: matchedKw.goto as unknown as KeywordGoto | undefined,
      captureVariable: matchedKw.captureVariable as unknown as CaptureVariableConfig | undefined,
      matchedTrigger,
    };
  }

  /**
   * Gera variações de keyword usando IA
   */
  async generateAIKeywords(keyword: { trigger: string; triggers: string[] }): Promise<string[]> {
    // Retorna a lista base - a geração real será feita pelo controller usando o AI service
    return keyword.triggers.length > 0 ? keyword.triggers : [keyword.trigger];
  }
}
