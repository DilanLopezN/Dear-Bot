import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationService } from '../conversation/conversation.service';
import { KeywordService, CaptureVariableConfig } from '../keyword/keyword.service';
import { MenuService } from '../menu/menu.service';
import { ClaudeService } from '../services/claude.service';
import { OpenAIService } from '../services/openai.service';
import { GeminiService } from '../services/gemini.service';
import { Dialog360Service } from '../services/dialog360.service';
import { VariableType } from '@prisma/client';

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

  /** Valida e converte o valor da variável de acordo com o tipo */
  private validateVariableValue(value: string, type: VariableType): { valid: boolean; parsed: string; errorMessage?: string } {
    switch (type) {
      case 'STRING':
        if (!value.trim()) {
          return { valid: false, parsed: value, errorMessage: 'O valor não pode estar vazio. Por favor, envie um texto.' };
        }
        return { valid: true, parsed: value.trim() };

      case 'NUMBER': {
        const num = Number(value.replace(',', '.'));
        if (isNaN(num)) {
          return { valid: false, parsed: value, errorMessage: 'Valor inválido. Por favor, envie um número válido (ex: 42 ou 3.14).' };
        }
        return { valid: true, parsed: String(num) };
      }

      case 'BOOLEAN': {
        const normalized = value.toLowerCase().trim();
        const trueValues = ['sim', 'yes', 'true', 's', 'y', '1', 'verdadeiro'];
        const falseValues = ['não', 'nao', 'no', 'false', 'n', '0', 'falso'];
        if (trueValues.includes(normalized)) {
          return { valid: true, parsed: 'true' };
        }
        if (falseValues.includes(normalized)) {
          return { valid: true, parsed: 'false' };
        }
        return { valid: false, parsed: value, errorMessage: 'Valor inválido. Por favor, responda com Sim ou Não.' };
      }

      case 'DATE': {
        // Aceita formatos: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
        const datePatterns = [
          /^(\d{2})\/(\d{2})\/(\d{4})$/,
          /^(\d{2})-(\d{2})-(\d{4})$/,
          /^(\d{4})-(\d{2})-(\d{2})$/,
        ];

        for (const pattern of datePatterns) {
          const match = value.trim().match(pattern);
          if (match) {
            let dateStr: string;
            if (pattern === datePatterns[2]) {
              // YYYY-MM-DD
              dateStr = `${match[1]}-${match[2]}-${match[3]}`;
            } else {
              // DD/MM/YYYY ou DD-MM-YYYY
              dateStr = `${match[3]}-${match[2]}-${match[1]}`;
            }
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
              return { valid: true, parsed: dateStr };
            }
          }
        }
        return { valid: false, parsed: value, errorMessage: 'Data inválida. Por favor, envie no formato DD/MM/AAAA (ex: 25/12/2025).' };
      }

      default:
        return { valid: true, parsed: value };
    }
  }

  /** Substitui variáveis no texto: {{nome_variavel}} → valor */
  private async interpolateVariables(text: string, conversationId: string): Promise<string> {
    const variablePattern = /\{\{(\w+)\}\}/g;
    const matches = text.match(variablePattern);
    if (!matches) return text;

    const variableNames = matches.map(m => m.replace(/\{\{|\}\}/g, ''));
    const variables = await this.prisma.conversationVariable.findMany({
      where: {
        conversationId,
        name: { in: variableNames },
      },
    });

    const varMap = new Map(variables.map(v => [v.name, v.value]));

    return text.replace(variablePattern, (_, name) => {
      return varMap.get(name) ?? `{{${name}}}`;
    });
  }

  /** Salva variável capturada na conversa */
  private async saveVariable(conversationId: string, name: string, type: VariableType, value: string) {
    await this.prisma.conversationVariable.upsert({
      where: { conversationId_name: { conversationId, name } },
      update: { value, type },
      create: { conversationId, name, type, value },
    });
    this.logger.log(`Variável '${name}' (${type}) = '${value}' salva na conversa ${conversationId}`);
  }

  /** Coloca a conversa em estado de espera para captura de variável */
  private async setWaitingForVariable(
    conversationId: string,
    variableConfig: CaptureVariableConfig,
    goto?: GotoConfig,
  ) {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        waitingForVariable: true,
        pendingVariableName: variableConfig.name,
        pendingVariableType: variableConfig.type as VariableType,
        pendingVariableGoto: goto ? (goto as any) : null,
      },
    });
  }

  /** Limpa o estado de espera de variável */
  private async clearWaitingForVariable(conversationId: string) {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        waitingForVariable: false,
        pendingVariableName: null,
        pendingVariableType: null,
        pendingVariableGoto: null,
      },
    });
  }

  /** Processa captura de variável pendente — retorna true se havia captura pendente */
  private async processVariableCapture(
    bot: any,
    from: string,
    conversation: any,
    text: string,
  ): Promise<boolean> {
    if (!conversation.waitingForVariable || !conversation.pendingVariableName || !conversation.pendingVariableType) {
      return false;
    }

    const apiKey = bot.whatsappChannel.dialog360ApiKey;
    const { valid, parsed, errorMessage } = this.validateVariableValue(text, conversation.pendingVariableType);

    if (!valid) {
      const result = await this.dialog360.sendTextMessage(apiKey, from, errorMessage!);
      await this.conversationService.saveMessage(
        conversation.id,
        'OUTBOUND',
        errorMessage!,
        result?.messages?.[0]?.id,
      );
      return true;
    }

    // Salvar a variável
    await this.saveVariable(
      conversation.id,
      conversation.pendingVariableName,
      conversation.pendingVariableType,
      parsed,
    );

    const pendingGoto = conversation.pendingVariableGoto as GotoConfig | null;

    // Limpar estado de espera
    await this.clearWaitingForVariable(conversation.id);

    // Confirmar captura
    const confirmMsg = await this.interpolateVariables(
      `Valor registrado para *${conversation.pendingVariableName}*: ${parsed}`,
      conversation.id,
    );
    const confirmResult = await this.dialog360.sendTextMessage(apiKey, from, confirmMsg);
    await this.conversationService.saveMessage(
      conversation.id,
      'OUTBOUND',
      confirmMsg,
      confirmResult?.messages?.[0]?.id,
    );

    // Executar goto pendente (se houver)
    if (pendingGoto) {
      await this.executeGoto(bot.id, apiKey, from, conversation.id, pendingGoto);
    }

    return true;
  }

  /** Inicia captura de variável: envia prompt e marca conversa como esperando */
  private async startVariableCapture(
    botId: string,
    apiKey: string,
    to: string,
    conversationId: string,
    variableConfig: CaptureVariableConfig,
    goto?: GotoConfig,
  ) {
    const promptMsg = await this.interpolateVariables(variableConfig.promptMessage, conversationId);
    const result = await this.dialog360.sendTextMessage(apiKey, to, promptMsg);
    await this.conversationService.saveMessage(
      conversationId,
      'OUTBOUND',
      promptMsg,
      result?.messages?.[0]?.id,
    );

    await this.setWaitingForVariable(conversationId, variableConfig, goto);
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
    const captureVariable = menu.captureVariable as unknown as CaptureVariableConfig | null;

    const bodyText = menu.body
      ? await this.interpolateVariables(menu.body, conversationId)
      : menu.title;

    const result = await this.dialog360.sendInteractiveListMessage(
      apiKey,
      to,
      menu.title,
      bodyText,
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

    // Se o menu tem captureVariable, iniciar captura após mostrar o menu
    if (captureVariable) {
      await this.startVariableCapture(botId, apiKey, to, conversationId, captureVariable);
    }
  }

  private async sendKeywordResponse(
    botId: string,
    apiKey: string,
    to: string,
    conversationId: string,
    keywordTrigger: string,
  ): Promise<{ goto?: GotoConfig; captureVariable?: CaptureVariableConfig }> {
    const keyword = await this.keywordService.findByExactTrigger(botId, keywordTrigger);
    if (!keyword) throw new Error(`Keyword '${keywordTrigger}' não encontrada`);

    const responseText = await this.interpolateVariables(keyword.response, conversationId);
    const result = await this.dialog360.sendTextMessage(apiKey, to, responseText);
    await this.conversationService.saveMessage(
      conversationId,
      'OUTBOUND',
      responseText,
      result?.messages?.[0]?.id,
    );

    return {
      goto: keyword.goto as GotoConfig | undefined,
      captureVariable: keyword.captureVariable as unknown as CaptureVariableConfig | undefined,
    };
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
      const { goto: nextGoto, captureVariable } = await this.sendKeywordResponse(botId, apiKey, to, conversationId, goto.target);

      // Se a keyword tem captura de variável, iniciar captura (goto será executado após captura)
      if (captureVariable) {
        await this.startVariableCapture(botId, apiKey, to, conversationId, captureVariable, nextGoto);
        return true;
      }

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

    const fallbackMsg = await this.interpolateVariables(fallback.message, conversationId);
    const result = await this.dialog360.sendTextMessage(apiKey, from, fallbackMsg);
    await this.conversationService.saveMessage(
      conversationId,
      'OUTBOUND',
      fallbackMsg,
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

        const { goto: nextGoto, captureVariable } = await this.sendKeywordResponse(
          bot.id,
          bot.whatsappChannel.dialog360ApiKey,
          from,
          conversation.id,
          step.keywordTrigger,
        );

        // Se a keyword tem captura de variável, iniciar captura
        if (captureVariable) {
          await this.startVariableCapture(
            bot.id,
            bot.whatsappChannel.dialog360ApiKey,
            from,
            conversation.id,
            captureVariable,
            nextGoto,
          );
        } else if (nextGoto) {
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
        'CONTACT',
      );

      // Atualizar lastMessageAt
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      });

      // Se a conversa está em modo humano, não processar pelo bot
      if (conversation.status === 'HUMAN') {
        this.logger.log(`Conversa ${conversation.id} em modo humano, ignorando processamento do bot`);
        return;
      }

      // Verificar se há captura de variável pendente
      const handledByCapture = await this.processVariableCapture(bot, from, conversation, text);
      if (handledByCapture) return;

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

      // Keyword match com suporte a goto e captureVariable
      let responseText: string | null = null;

      switch (bot.responseMode) {
        case 'KEYWORDS': {
          const match = await this.keywordService.findMatch(botId, text);
          if (match) {
            responseText = await this.interpolateVariables(match.response, conversation.id);
            const result = await this.dialog360.sendTextMessage(apiKey, from, responseText);
            await this.conversationService.saveMessage(
              conversation.id,
              'OUTBOUND',
              responseText,
              result?.messages?.[0]?.id,
            );

            // Se tiver captureVariable, iniciar captura (goto executará após captura)
            if (match.captureVariable) {
              await this.startVariableCapture(botId, apiKey, from, conversation.id, match.captureVariable, match.goto);
              return;
            }

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
            responseText = await this.interpolateVariables(match.response, conversation.id);
            const result = await this.dialog360.sendTextMessage(apiKey, from, responseText);
            await this.conversationService.saveMessage(
              conversation.id,
              'OUTBOUND',
              responseText,
              result?.messages?.[0]?.id,
            );

            if (match.captureVariable) {
              await this.startVariableCapture(botId, apiKey, from, conversation.id, match.captureVariable, match.goto);
              return;
            }

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
        const interpolated = await this.interpolateVariables(responseText, conversation.id);
        const result = await this.dialog360.sendTextMessage(apiKey, from, interpolated);

        await this.conversationService.saveMessage(
          conversation.id,
          'OUTBOUND',
          interpolated,
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

      // Se a conversa está aguardando variável, a seleção interativa pode ser usada como valor
      const handledByCapture = await this.processVariableCapture(bot, from, conversation, selectedTitle);
      if (handledByCapture) return;

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
