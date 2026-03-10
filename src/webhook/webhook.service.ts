import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationService } from '../conversation/conversation.service';
import { KeywordService } from '../keyword/keyword.service';
import { MenuService } from '../menu/menu.service';
import { ClaudeService } from '../services/claude.service';
import { OpenAIService } from '../services/openai.service';
import { GeminiService } from '../services/gemini.service';
import { Dialog360Service } from '../services/dialog360.service';

type MessageStatus = 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

type GotoConfig = {
  type: 'MENU' | 'KEYWORD';
  target: string;
};

type FlowStep = {
  type: 'GOTO_MENU' | 'GOTO_KEYWORD';
  menuTrigger?: string;
  keywordTrigger?: string;
};

type FlowConfig = {
  initialInteraction?: GotoConfig;
  steps?: FlowStep[];
  fallback?: {
    message: string;
    goto?: GotoConfig;
  };
};

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private prisma: PrismaService,
    private conversationService: ConversationService,
    private keywordService: KeywordService,
    private menuService: MenuService,
    private claudeService: ClaudeService,
    private openaiService: OpenAIService,
    private geminiService: GeminiService,
    private dialog360: Dialog360Service,
  ) {}

  private parseFlowConfig(raw: unknown): FlowConfig {
    if (!raw || typeof raw !== 'object') return {};
    return raw as FlowConfig;
  }

  /** Gera resposta via IA usando o provedor configurado no bot */
  private async generateAIResponse(
    bot: any,
    conversationId: string,
    text: string,
  ): Promise<string> {
    const aiConfig = bot.aiConfig;

    if (aiConfig) {
      switch (aiConfig.provider) {
        case 'OPENAI':
          return this.openaiService.generateResponse(
            conversationId,
            text,
            bot.systemPrompt || undefined,
            aiConfig.apiKey,
            aiConfig.model,
            aiConfig.maxTokens,
            aiConfig.temperature,
          );
        case 'GEMINI':
          return this.geminiService.generateResponse(
            conversationId,
            text,
            bot.systemPrompt || undefined,
            aiConfig.apiKey,
            aiConfig.model,
            aiConfig.maxTokens,
            aiConfig.temperature,
          );
        case 'CLAUDE':
        default:
          return this.claudeService.generateResponse(
            conversationId,
            text,
            bot.systemPrompt || undefined,
          );
      }
    }

    return this.claudeService.generateResponse(
      conversationId,
      text,
      bot.systemPrompt || undefined,
    );
  }

  private async sendMenu(
    botId: string,
    apiKey: string,
    to: string,
    conversationId: string,
    menuTrigger: string,
  ) {
    const menu = await this.menuService.findByTrigger(botId, menuTrigger);
    if (!menu) throw new Error(`Menu '${menuTrigger}' não encontrado`);

    const options = menu.options as Array<{ id: string; title: string; description?: string }>;
    const result = await this.dialog360.sendInteractiveListMessage(
      apiKey,
      to,
      menu.title,
      menu.body || menu.title,
      menu.footer || undefined,
      'Ver opções',
      [{ title: menu.title, rows: options.map((o) => ({ id: o.id, title: o.title, description: o.description })) }],
    );

    const menuText = `📋 ${menu.title}\n${options.map((o, i) => `${i + 1}. ${o.title}${o.description ? ' - ' + o.description : ''}`).join('\n')}`;
    await this.conversationService.saveMessage(
      conversationId,
      'OUTBOUND',
      menuText,
      result?.messages?.[0]?.id,
    );
  }

  private async sendKeywordResponse(
    botId: string,
    apiKey: string,
    to: string,
    conversationId: string,
    keywordTrigger: string,
  ): Promise<GotoConfig | undefined> {
    const keyword = await this.keywordService.findByExactTrigger(botId, keywordTrigger);
    if (!keyword) throw new Error(`Keyword '${keywordTrigger}' não encontrada`);

    const result = await this.dialog360.sendTextMessage(apiKey, to, keyword.response);
    await this.conversationService.saveMessage(
      conversationId,
      'OUTBOUND',
      keyword.response,
      result?.messages?.[0]?.id,
    );

    return keyword.goto as GotoConfig | undefined;
  }

  private async executeGoto(
    botId: string,
    apiKey: string,
    to: string,
    conversationId: string,
    goto?: GotoConfig,
  ) {
    if (!goto) return false;

    if (goto.type === 'MENU') {
      await this.sendMenu(botId, apiKey, to, conversationId, goto.target);
      return true;
    }

    if (goto.type === 'KEYWORD') {
      const nextGoto = await this.sendKeywordResponse(botId, apiKey, to, conversationId, goto.target);
      // Se a keyword tiver goto, seguir a cadeia
      if (nextGoto) {
        await this.executeGoto(botId, apiKey, to, conversationId, nextGoto);
      }
      return true;
    }

    return false;
  }

  private async executeFallback(
    bot: any,
    from: string,
    conversationId: string,
    reason: string,
  ) {
    const flow = this.parseFlowConfig(bot.flowConfig);
    const fallback = flow.fallback;
    const apiKey = bot.whatsappChannel.dialog360ApiKey;

    if (!fallback?.message) {
      this.logger.warn(`Falha no fluxo sem fallback configurado: ${reason}`);
      return;
    }

    const result = await this.dialog360.sendTextMessage(apiKey, from, fallback.message);
    await this.conversationService.saveMessage(
      conversationId,
      'OUTBOUND',
      fallback.message,
      result?.messages?.[0]?.id,
    );

    if (fallback.goto) {
      await this.executeGoto(bot.id, apiKey, from, conversationId, fallback.goto);
    }
  }

  private async processConfiguredFlowStep(
    bot: any,
    from: string,
    conversation: any,
  ): Promise<boolean> {
    const flow = this.parseFlowConfig(bot.flowConfig);
    const steps = flow.steps || [];

    if (!steps.length) return false;

    const step = steps[conversation.flowStepIndex];
    if (!step) return false;

    try {
      if (step.type === 'GOTO_MENU') {
        if (!step.menuTrigger) throw new Error('GOTO_MENU sem menuTrigger configurado');

        await this.sendMenu(
          bot.id,
          bot.whatsappChannel.dialog360ApiKey,
          from,
          conversation.id,
          step.menuTrigger,
        );

        await this.prisma.conversation.update({
          where: { id: conversation.id },
          data: { flowStepIndex: conversation.flowStepIndex + 1 },
        });
        return true;
      }

      if (step.type === 'GOTO_KEYWORD') {
        if (!step.keywordTrigger) throw new Error('GOTO_KEYWORD sem keywordTrigger configurado');

        const nextGoto = await this.sendKeywordResponse(
          bot.id,
          bot.whatsappChannel.dialog360ApiKey,
          from,
          conversation.id,
          step.keywordTrigger,
        );

        // Se a keyword tiver goto, seguir a cadeia
        if (nextGoto) {
          await this.executeGoto(
            bot.id,
            bot.whatsappChannel.dialog360ApiKey,
            from,
            conversation.id,
            nextGoto,
          );
        }

        await this.prisma.conversation.update({
          where: { id: conversation.id },
          data: { flowStepIndex: conversation.flowStepIndex + 1 },
        });
        return true;
      }
    } catch (error) {
      await this.executeFallback(bot, from, conversation.id, error.message);
      return true;
    }

    return false;
  }

  async processIncomingMessage(
    botId: string,
    from: string,
    text: string,
    messageId: string,
    contactName?: string,
  ) {
    try {
      const bot = await this.prisma.bot.findUnique({
        where: { id: botId },
        include: { whatsappChannel: true, aiConfig: true },
      });

      if (!bot || !bot.isActive || !bot.whatsappChannel) {
        this.logger.warn(`Bot ${botId} não encontrado ou inativo`);
        return;
      }

      const apiKey = bot.whatsappChannel.dialog360ApiKey;
      await this.dialog360.markAsRead(apiKey, messageId);

      const conversation = await this.conversationService.getOrCreate(
        botId,
        from,
        contactName,
      );

      const conversationMessagesCount = await this.prisma.message.count({
        where: { conversationId: conversation.id },
      });
      const isFirstInteraction = conversationMessagesCount === 0;

      await this.conversationService.saveMessage(
        conversation.id,
        'INBOUND',
        text,
        messageId,
      );

      // Primeira interação: usar initialInteraction (goto) ou initialMessage (texto legado)
      if (isFirstInteraction) {
        const flow = this.parseFlowConfig(bot.flowConfig);

        if (flow.initialInteraction) {
          try {
            await this.executeGoto(bot.id, apiKey, from, conversation.id, flow.initialInteraction);
            return;
          } catch (error) {
            this.logger.warn(`Falha ao executar initialInteraction: ${error.message}`);
            await this.executeFallback(bot, from, conversation.id, error.message);
            return;
          }
        } else if (bot.initialMessage) {
          const initialResult = await this.dialog360.sendTextMessage(apiKey, from, bot.initialMessage);
          await this.conversationService.saveMessage(
            conversation.id,
            'OUTBOUND',
            bot.initialMessage,
            initialResult?.messages?.[0]?.id,
          );
        }
      }

      const handledByFlow = await this.processConfiguredFlowStep(bot, from, conversation);
      if (handledByFlow) return;

      const menuMatch = await this.menuService.findMenuMatch(botId, text);
      if (menuMatch) {
        const { menu } = menuMatch;
        await this.sendMenu(botId, apiKey, from, conversation.id, menu.trigger);
        return;
      }

      const optionMatch = await this.menuService.findOptionResponse(botId, text);
      if (optionMatch) {
        if (optionMatch.option.goto) {
          await this.executeGoto(botId, apiKey, from, conversation.id, optionMatch.option.goto);
          return;
        }

        const responseText = `Você selecionou: ${optionMatch.option.title}`;
        const result = await this.dialog360.sendTextMessage(apiKey, from, responseText);
        await this.conversationService.saveMessage(
          conversation.id,
          'OUTBOUND',
          responseText,
          result?.messages?.[0]?.id,
        );
        return;
      }

      // Keyword match com suporte a goto
      let responseText: string | null = null;

      switch (bot.responseMode) {
        case 'KEYWORDS': {
          const match = await this.keywordService.findMatch(botId, text);
          if (match) {
            responseText = match.response;
            // Enviar resposta da keyword
            const result = await this.dialog360.sendTextMessage(apiKey, from, responseText);
            await this.conversationService.saveMessage(
              conversation.id,
              'OUTBOUND',
              responseText,
              result?.messages?.[0]?.id,
            );
            // Se tiver goto, navegar
            if (match.goto) {
              await this.executeGoto(botId, apiKey, from, conversation.id, match.goto);
            }
            return;
          }
          responseText = 'Desculpe, não entendi. Tente reformular sua pergunta.';
          break;
        }

        case 'AI':
          responseText = await this.generateAIResponse(bot, conversation.id, text);
          break;

        case 'HYBRID': {
          const match = await this.keywordService.findMatch(botId, text);
          if (match) {
            responseText = match.response;
            const result = await this.dialog360.sendTextMessage(apiKey, from, responseText);
            await this.conversationService.saveMessage(
              conversation.id,
              'OUTBOUND',
              responseText,
              result?.messages?.[0]?.id,
            );
            if (match.goto) {
              await this.executeGoto(botId, apiKey, from, conversation.id, match.goto);
            }
            return;
          }
          responseText = await this.generateAIResponse(bot, conversation.id, text);
          break;
        }
      }

      if (responseText) {
        const result = await this.dialog360.sendTextMessage(apiKey, from, responseText);

        await this.conversationService.saveMessage(
          conversation.id,
          'OUTBOUND',
          responseText,
          result?.messages?.[0]?.id,
        );
      }
    } catch (error) {
      this.logger.error(`Erro processando mensagem: ${error.message}`, error.stack);
    }
  }

  async processInteractiveResponse(
    botId: string,
    from: string,
    interactiveType: string,
    selectedId: string,
    selectedTitle: string,
    messageId: string,
    contactName?: string,
  ) {
    try {
      const bot = await this.prisma.bot.findUnique({
        where: { id: botId },
        include: { whatsappChannel: true },
      });

      if (!bot || !bot.isActive || !bot.whatsappChannel) return;

      const apiKey = bot.whatsappChannel.dialog360ApiKey;
      await this.dialog360.markAsRead(apiKey, messageId);

      const conversation = await this.conversationService.getOrCreate(botId, from, contactName);

      await this.conversationService.saveMessage(
        conversation.id,
        'INBOUND',
        `[${selectedTitle}]`,
        messageId,
      );

      const optionMatch = await this.menuService.findOptionResponse(botId, selectedId);
      if (optionMatch?.option.goto) {
        try {
          await this.executeGoto(botId, apiKey, from, conversation.id, optionMatch.option.goto);
        } catch (error) {
          await this.executeFallback(bot, from, conversation.id, error.message);
        }
        return;
      }

      const responseText = optionMatch
        ? `Você selecionou: ${optionMatch.option.title}${optionMatch.option.description ? '\n' + optionMatch.option.description : ''}`
        : `Opção selecionada: ${selectedTitle}`;

      const result = await this.dialog360.sendTextMessage(apiKey, from, responseText);
      await this.conversationService.saveMessage(
        conversation.id,
        'OUTBOUND',
        responseText,
        result?.messages?.[0]?.id,
      );
    } catch (error) {
      this.logger.error(`Erro processando resposta interativa: ${error.message}`, error.stack);
    }
  }

  async processStatusUpdate(botId: string, messageId: string, status: string) {
    try {
      const statusMap: Record<string, MessageStatus> = {
        sent: 'SENT',
        delivered: 'DELIVERED',
        read: 'READ',
        failed: 'FAILED',
      };

      const mappedStatus = statusMap[status];
      if (!mappedStatus) return;

      await this.prisma.message.updateMany({
        where: { dialog360MsgId: messageId },
        data: { status: mappedStatus },
      });
    } catch (error) {
      this.logger.error(`Erro atualizando status: ${error.message}`);
    }
  }
}
