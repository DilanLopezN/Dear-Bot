import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BotService } from '../bot/bot.service';
import { ClaudeService } from '../services/claude.service';
import { OpenAIService } from '../services/openai.service';
import { GeminiService } from '../services/gemini.service';

@Injectable()
export class KeywordAIService {
  private readonly logger = new Logger(KeywordAIService.name);

  constructor(
    private prisma: PrismaService,
    private botService: BotService,
    private claudeService: ClaudeService,
    private openaiService: OpenAIService,
    private geminiService: GeminiService,
  ) {}

  /**
   * Gera variações de keyword usando I.A. baseado no trigger principal
   * e atualiza a lista de triggers da keyword
   */
  async enhanceKeyword(userId: string, botId: string, keywordId: string) {
    await this.botService.findOne(userId, botId);

    const keyword = await this.prisma.keyword.findFirst({
      where: { id: keywordId, botId },
    });
    if (!keyword) throw new NotFoundException('Keyword não encontrada');

    const bot = await this.prisma.bot.findUnique({
      where: { id: botId },
      include: { aiConfig: true },
    });

    const mainTrigger = keyword.trigger;
    const existingTriggers = keyword.triggers && keyword.triggers.length > 0
      ? keyword.triggers
      : [mainTrigger];

    const prompt = `Você é um especialista em chatbots e atendimento ao cliente via WhatsApp.
Dado a keyword principal "${mainTrigger}", gere variações comuns que um usuário real digitaria no WhatsApp.

Considere:
- Erros de digitação comuns
- Abreviações (ex: "vc" para "você")
- Variações com acentos e sem acentos
- Gírias e formas informais
- Variações com letras repetidas (ex: "oiii", "olaaaa")
- Formas mais formais e informais

Keywords existentes: ${existingTriggers.join(', ')}

Gere APENAS as novas variações (não repita as existentes).
Responda SOMENTE com as palavras separadas por vírgula, sem explicações, sem numeração, sem aspas.
Gere entre 5 e 15 variações.`;

    let aiResponse: string;

    try {
      if (bot?.aiConfig) {
        const { apiKey, model, maxTokens, temperature, provider } = bot.aiConfig;
        switch (provider) {
          case 'OPENAI':
            aiResponse = await this.openaiService.generateResponse(
              'keyword-enhance', prompt, 'Responda apenas com as variações separadas por vírgula.',
              apiKey, model, maxTokens, temperature,
            );
            break;
          case 'GEMINI':
            aiResponse = await this.geminiService.generateResponse(
              'keyword-enhance', prompt, 'Responda apenas com as variações separadas por vírgula.',
              apiKey, model, maxTokens, temperature,
            );
            break;
          case 'CLAUDE':
          default:
            aiResponse = await this.claudeService.generateResponse(
              'keyword-enhance', prompt, 'Responda apenas com as variações separadas por vírgula.',
              apiKey, model, maxTokens, temperature,
            );
            break;
        }
      } else {
        // Sem AI config, retornar apenas as existentes
        return {
          message: 'Nenhuma configuração de I.A. encontrada. Configure um provedor de I.A. no bot.',
          keyword: keywordId,
          triggers: existingTriggers,
        };
      }
    } catch (err) {
      this.logger.error(`Erro ao gerar variações com I.A.: ${err.message}`);
      throw err;
    }

    // Parse da resposta da IA
    const newVariations = aiResponse
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(s => s.length > 0 && s.length < 100);

    // Merge com existentes (sem duplicatas)
    const existingSet = new Set(existingTriggers.map(t => t.toLowerCase().trim()));
    const uniqueNew = newVariations.filter(v => !existingSet.has(v));
    const allTriggers = [...existingTriggers, ...uniqueNew];

    // Atualizar no banco
    const updated = await this.prisma.keyword.update({
      where: { id: keywordId },
      data: { triggers: allTriggers },
    });

    this.logger.log(`Keyword "${mainTrigger}" aprimorada com ${uniqueNew.length} novas variações`);

    return {
      message: `${uniqueNew.length} novas variações geradas pela I.A.`,
      keyword: keywordId,
      trigger: mainTrigger,
      newVariations: uniqueNew,
      allTriggers: updated.triggers,
    };
  }

  /**
   * Usa I.A. para identificar qual keyword mais se aproxima da mensagem do usuário.
   * Usado no fluxo de processamento de mensagens nos modos AI e HYBRID.
   */
  async matchKeywordWithAI(
    bot: any,
    message: string,
    keywords: Array<{ trigger: string; triggers: string[] }>,
  ): Promise<string | null> {
    if (!bot.aiConfig) return null;

    const keywordList = keywords.map(k => {
      const all = k.triggers.length > 0 ? k.triggers : [k.trigger];
      return `- ${k.trigger} (variações: ${all.join(', ')})`;
    }).join('\n');

    const prompt = `Você é um assistente de chatbot. O usuário enviou a mensagem: "${message}"

Estas são as keywords disponíveis no bot:
${keywordList}

Se a mensagem do usuário corresponde a alguma dessas keywords (mesmo que seja uma variação, erro de digitação ou sinônimo), responda APENAS com o trigger principal da keyword correspondente.
Se NÃO corresponde a nenhuma keyword, responda APENAS com "NONE".
Responda SOMENTE com o trigger ou "NONE", sem explicações.`;

    try {
      const { apiKey, model, maxTokens, temperature, provider } = bot.aiConfig;
      let response: string;

      switch (provider) {
        case 'OPENAI':
          response = await this.openaiService.generateResponse(
            'keyword-match', prompt, 'Responda apenas com o trigger ou NONE.',
            apiKey, model, maxTokens, temperature,
          );
          break;
        case 'GEMINI':
          response = await this.geminiService.generateResponse(
            'keyword-match', prompt, 'Responda apenas com o trigger ou NONE.',
            apiKey, model, maxTokens, temperature,
          );
          break;
        case 'CLAUDE':
        default:
          response = await this.claudeService.generateResponse(
            'keyword-match', prompt, 'Responda apenas com o trigger ou NONE.',
            apiKey, model, maxTokens, temperature,
          );
          break;
      }

      const cleaned = response.trim().toLowerCase();
      if (cleaned === 'none' || cleaned === '"none"') return null;

      // Verificar se o trigger retornado é válido
      const matchedKw = keywords.find(k =>
        k.trigger.toLowerCase() === cleaned ||
        k.triggers.some(t => t.toLowerCase() === cleaned),
      );

      return matchedKw ? matchedKw.trigger : null;
    } catch (err) {
      this.logger.warn(`Erro ao fazer match de keyword com I.A.: ${err.message}`);
      return null;
    }
  }
}
