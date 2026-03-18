import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationService } from '../conversation/conversation.service';
import { KeywordService, CaptureVariableConfig } from '../keyword/keyword.service';
import { MenuService } from '../menu/menu.service';
import { ClaudeService } from '../services/claude.service';
import { OpenAIService } from '../services/openai.service';
import { GeminiService } from '../services/gemini.service';
import { MessagingService, ChannelConfig, EMULATOR_CHANNEL } from '../services/messaging.service';
import { ContactService } from '../contact/contact.service';
import { LeadService } from '../lead/lead.service';
import { IterationService } from '../iteration/iteration.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { ContextCacheService } from './context-cache.service';
import { ConversationContext, serializeContextForAI } from './conversation-context';
import { Prisma, VariableType } from '@prisma/client';

type MessageStatus = 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

type GotoConfig = {
  type: 'MENU' | 'KEYWORD' | 'ITERATION' | 'LAST_INTERACTION';
  target: string;
};

type FlowStep = {
  type: 'GOTO_MENU' | 'GOTO_KEYWORD';
  menuTrigger?: string;
  keywordTrigger?: string;
};

type FlowConfig = {
  initialInteraction?: GotoConfig;
  lastInteraction?: GotoConfig;
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
    private messaging: MessagingService,
    private contactService: ContactService,
    private leadService: LeadService,
    private iterationService: IterationService,
    private knowledgeService: KnowledgeService,
    private contextCache: ContextCacheService,
  ) {}

  /** Constrói ou recupera do cache o contexto da conversa */
  private async getOrBuildContext(conversation: any): Promise<ConversationContext> {
    const cached = this.contextCache.get(conversation.id);
    if (cached) {
      cached.lastMessageAt = new Date();
      cached.messageCount++;
      cached.status = conversation.status;
      cached.waitingForVariable = conversation.waitingForVariable;
      cached.pendingVariableName = conversation.pendingVariableName;
      cached.pendingVariableType = conversation.pendingVariableType;
      return cached;
    }

    const variables = await this.prisma.conversationVariable.findMany({
      where: { conversationId: conversation.id },
    });

    const messageCount = await this.prisma.message.count({
      where: { conversationId: conversation.id },
    });

    const variablesMap: Record<string, any> = {};
    for (const v of variables) {
      variablesMap[v.name] = {
        name: v.name,
        type: v.type,
        value: v.value,
        capturedAt: v.createdAt,
      };
    }

    const context: ConversationContext = {
      conversationId: conversation.id,
      botId: conversation.botId,
      contactPhone: conversation.contactPhone,
      contactName: conversation.contactName,
      status: conversation.status,
      flowStepIndex: conversation.flowStepIndex || 0,
      waitingForVariable: conversation.waitingForVariable || false,
      pendingVariableName: conversation.pendingVariableName,
      pendingVariableType: conversation.pendingVariableType,
      variables: variablesMap,
      createdAt: conversation.createdAt,
      lastMessageAt: new Date(),
      messageCount,
    };

    this.contextCache.set(conversation.id, context);
    return context;
  }

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
  private async interpolateVariables(text: string, conversationId: string, context?: ConversationContext): Promise<string> {
    const variablePattern = /\{\{(\w+)\}\}/g;
    const matches = text.match(variablePattern);
    if (!matches) return text;

    // Se temos contexto em cache, usar diretamente sem consultar o DB
    if (context) {
      return text.replace(variablePattern, (_, name) => {
        return context.variables[name]?.value ?? `{{${name}}}`;
      });
    }

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

    // Atualizar cache de contexto
    this.contextCache.updateVariable(conversationId, name, {
      name,
      type,
      value,
      capturedAt: new Date(),
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
        pendingVariableGoto: Prisma.JsonNull,
      },
    });

    this.contextCache.updateContext(conversationId, {
      waitingForVariable: false,
      pendingVariableName: null,
      pendingVariableType: null,
    });
  }

  /** Processa captura de variável pendente — retorna true se havia captura pendente */
  private async processVariableCapture(
    bot: any,
    channel: ChannelConfig,
    from: string,
    conversation: any,
    text: string,
  ): Promise<boolean> {
    if (!conversation.waitingForVariable || !conversation.pendingVariableName || !conversation.pendingVariableType) {
      return false;
    }

    const { valid, parsed, errorMessage } = this.validateVariableValue(text, conversation.pendingVariableType);

    if (!valid) {
      const result = await this.messaging.sendTextMessage(channel, from, errorMessage!);
      await this.conversationService.saveMessage(
        conversation.id,
        'OUTBOUND',
        errorMessage!,
        result?.messageId,
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
    const confirmMsg = 'Dado registrado com sucesso ✅';
    const confirmResult = await this.messaging.sendTextMessage(channel, from, confirmMsg);
    await this.conversationService.saveMessage(
      conversation.id,
      'OUTBOUND',
      confirmMsg,
      confirmResult?.messageId,
    );

    // Executar goto pendente (se houver)
    if (pendingGoto) {
      await this.executeGoto(bot.id, channel, from, conversation.id, pendingGoto);
    }

    // Continuar automaticamente para a próxima etapa do fluxo (sem precisar de nova mensagem do usuário)
    const updatedConversation = await this.prisma.conversation.findUnique({
      where: { id: conversation.id },
    });
    if (updatedConversation && !updatedConversation.waitingForVariable) {
      await this.processConfiguredFlowStep(bot, channel, from, updatedConversation);
    }

    return true;
  }

  /** Inicia captura de variável: envia prompt e marca conversa como esperando */
  private async startVariableCapture(
    botId: string,
    channel: ChannelConfig,
    to: string,
    conversationId: string,
    variableConfig: CaptureVariableConfig,
    goto?: GotoConfig,
  ) {
    const promptMsg = await this.interpolateVariables(variableConfig.promptMessage, conversationId);
    const result = await this.messaging.sendTextMessage(channel, to, promptMsg);
    await this.conversationService.saveMessage(
      conversationId,
      'OUTBOUND',
      promptMsg,
      result?.messageId,
    );

    await this.setWaitingForVariable(conversationId, variableConfig, goto);
  }

  /** Gera resposta via IA usando o provedor configurado no bot, enriquecida com contexto da conversa */
  private async generateAIResponse(
    bot: any,
    conversationId: string,
    text: string,
    context?: ConversationContext,
    hybridFlowHint?: string,
  ): Promise<string> {
    // Enriquecer o systemPrompt com o contexto da conversa
    const basePrompt = bot.systemPrompt || 'Você é um assistente de atendimento ao cliente. Responda de forma educada, objetiva e útil. Responda no idioma do cliente.';
    let enrichedPrompt = context
      ? `${basePrompt}\n\n${serializeContextForAI(context)}`
      : basePrompt;

    // No modo HYBRID, adicionar instrução para guiar o usuário de volta ao fluxo
    if (hybridFlowHint) {
      enrichedPrompt += `\n\n## Modo Híbrido - Instrução Especial\nO usuário perguntou algo fora do fluxo do bot. Responda a pergunta do usuário de forma útil e educada, mas ao final da resposta, gentilmente guie o usuário de volta ao fluxo do atendimento. ${hybridFlowHint}`;
    }

    // Buscar conhecimento relevante via RAG
    let knowledgeContext: string | undefined;
    try {
      const relevantChunks = await this.knowledgeService.searchRelevantChunks(bot.id, text, 5);
      if (relevantChunks.length > 0) {
        knowledgeContext = relevantChunks.join('\n\n---\n\n');
      }
    } catch (error) {
      this.logger.warn(`Erro ao buscar conhecimento para bot ${bot.id}: ${error.message}`);
    }

    const aiConfig = bot.aiConfig;

    if (aiConfig) {
      switch (aiConfig.provider) {
        case 'OPENAI':
          return this.openaiService.generateResponse(
            conversationId,
            text,
            enrichedPrompt,
            aiConfig.apiKey,
            aiConfig.model,
            aiConfig.maxTokens,
            aiConfig.temperature,
            knowledgeContext,
          );
        case 'GEMINI':
          return this.geminiService.generateResponse(
            conversationId,
            text,
            enrichedPrompt,
            aiConfig.apiKey,
            aiConfig.model,
            aiConfig.maxTokens,
            aiConfig.temperature,
            knowledgeContext,
          );
        case 'CLAUDE':
        default:
          return this.claudeService.generateResponse(
            conversationId,
            text,
            enrichedPrompt,
            aiConfig.apiKey,
            aiConfig.model,
            aiConfig.maxTokens,
            aiConfig.temperature,
            knowledgeContext,
          );
      }
    }

    return this.claudeService.generateResponse(
      conversationId,
      text,
      enrichedPrompt,
      undefined,
      undefined,
      undefined,
      undefined,
      knowledgeContext,
    );
  }

  private async sendMenu(
    botId: string,
    channel: ChannelConfig,
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

    const result = await this.messaging.sendInteractiveListMessage(
      channel,
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
      result?.messageId,
    );

    // Se o menu tem captureVariable, iniciar captura após mostrar o menu
    if (captureVariable) {
      await this.startVariableCapture(botId, channel, to, conversationId, captureVariable);
    }
  }

  private async sendKeywordResponse(
    botId: string,
    channel: ChannelConfig,
    to: string,
    conversationId: string,
    keywordTrigger: string,
  ): Promise<{ goto?: GotoConfig; captureVariable?: CaptureVariableConfig }> {
    const keyword = await this.keywordService.findByExactTrigger(botId, keywordTrigger);
    if (!keyword) throw new Error(`Keyword '${keywordTrigger}' não encontrada`);

    const responseText = await this.interpolateVariables(keyword.response, conversationId);
    const result = await this.messaging.sendTextMessage(channel, to, responseText);
    await this.conversationService.saveMessage(
      conversationId,
      'OUTBOUND',
      responseText,
      result?.messageId,
    );

    return {
      goto: keyword.goto as GotoConfig | undefined,
      captureVariable: keyword.captureVariable as unknown as CaptureVariableConfig | undefined,
    };
  }

  private async executeGoto(
    botId: string,
    channel: ChannelConfig,
    to: string,
    conversationId: string,
    goto?: GotoConfig,
    closeAfter = false,
  ) {
    if (!goto) return false;

    if (goto.type === 'MENU') {
      await this.sendMenu(botId, channel, to, conversationId, goto.target);
      if (closeAfter) await this.closeConversation(conversationId);
      return true;
    }

    if (goto.type === 'KEYWORD') {
      const { goto: nextGoto, captureVariable } = await this.sendKeywordResponse(botId, channel, to, conversationId, goto.target);

      // Se a keyword tem captura de variável, iniciar captura (goto será executado após captura)
      if (captureVariable) {
        await this.startVariableCapture(botId, channel, to, conversationId, captureVariable, nextGoto);
        if (closeAfter && !nextGoto) await this.closeConversation(conversationId);
        return true;
      }

      // Se a keyword tiver goto, seguir a cadeia
      if (nextGoto) {
        await this.executeGoto(botId, channel, to, conversationId, nextGoto, closeAfter);
      } else if (closeAfter) {
        await this.closeConversation(conversationId);
      }
      return true;
    }

    if (goto.type === 'ITERATION') {
      await this.executeIterations(botId, channel, to, conversationId);
      if (closeAfter) await this.closeConversation(conversationId);
      return true;
    }

    // LAST_INTERACTION: executa o lastInteraction configurado no flowConfig e fecha a conversa
    if (goto.type === 'LAST_INTERACTION') {
      const bot = await this.prisma.bot.findUnique({ where: { id: botId } });
      if (bot) {
        const flow = this.parseFlowConfig(bot.flowConfig);
        if (flow.lastInteraction) {
          await this.executeGoto(botId, channel, to, conversationId, flow.lastInteraction, true);
        } else {
          // Se não tem lastInteraction configurado, apenas fecha
          const closeMsg = 'Atendimento encerrado. Obrigado pelo contato!';
          const result = await this.messaging.sendTextMessage(channel, to, closeMsg);
          await this.conversationService.saveMessage(conversationId, 'OUTBOUND', closeMsg, result?.messageId);
          await this.closeConversation(conversationId);
        }
      }
      return true;
    }

    return false;
  }

  /** Executa todas as iterações ativas do bot em sequência */
  private async executeIterations(
    botId: string,
    channel: ChannelConfig,
    to: string,
    conversationId: string,
  ) {
    const iterations = await this.iterationService.findActiveByBot(botId);
    if (!iterations.length) {
      this.logger.warn(`Nenhuma iteração ativa encontrada para bot ${botId}`);
      return;
    }

    for (const iteration of iterations) {
      const content = iteration.content as any;

      switch (iteration.type) {
        case 'TEXT': {
          const text = await this.interpolateVariables(content.message || '', conversationId);
          const result = await this.messaging.sendTextMessage(channel, to, text);
          await this.conversationService.saveMessage(conversationId, 'OUTBOUND', text, result?.messageId);
          break;
        }

        case 'LINK': {
          const linkText = content.title
            ? `${content.title}\n${content.url}`
            : content.url;
          const interpolated = await this.interpolateVariables(linkText, conversationId);
          const result = await this.messaging.sendTextMessage(channel, to, interpolated);
          await this.conversationService.saveMessage(conversationId, 'OUTBOUND', interpolated, result?.messageId);
          break;
        }

        case 'DOCUMENT': {
          const mediaType = content.mediaType || 'document';
          const result = await this.messaging.sendMediaMessage(
            channel,
            to,
            mediaType,
            content.url,
            content.caption,
            content.filename,
          );
          const savedContent = content.caption
            ? `[${mediaType}] ${content.caption} — ${content.url}`
            : `[${mediaType}] ${content.url}`;
          await this.conversationService.saveMessage(conversationId, 'OUTBOUND', savedContent, result?.messageId);
          break;
        }

        case 'GOTO': {
          const gotoConfig: GotoConfig = { type: content.type, target: content.target };
          await this.executeGoto(botId, channel, to, conversationId, gotoConfig);
          break;
        }

        case 'CAPTURE_VARIABLE': {
          const captureConfig = {
            name: content.name,
            type: content.variableType || 'STRING',
            promptMessage: content.promptMessage,
          };
          const gotoAfter = content.goto ? { type: content.goto.type, target: content.goto.target } : undefined;
          await this.startVariableCapture(botId, channel, to, conversationId, captureConfig, gotoAfter);
          return; // Paramos a cadeia pois aguardamos input do usuário
        }

        case 'CLOSE_CONVERSATION': {
          const closeMsg = content.message || 'Atendimento encerrado. Obrigado pelo contato!';
          const interpolatedMsg = await this.interpolateVariables(closeMsg, conversationId);
          const result = await this.messaging.sendTextMessage(channel, to, interpolatedMsg);
          await this.conversationService.saveMessage(conversationId, 'OUTBOUND', interpolatedMsg, result?.messageId);
          await this.closeConversation(conversationId);
          return; // Paramos a cadeia pois a conversa foi encerrada
        }
      }
    }
  }

  /** Encerra a conversa, marcando como CLOSED */
  private async closeConversation(conversationId: string) {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: 'CLOSED',
        isActive: false,
      },
    });
    this.contextCache.invalidate(conversationId);
    this.logger.log(`Conversa ${conversationId} encerrada (CLOSED)`);
  }

  private async executeFallback(
    bot: any,
    channel: ChannelConfig,
    from: string,
    conversationId: string,
    reason: string,
  ) {
    const flow = this.parseFlowConfig(bot.flowConfig);
    const fallback = flow.fallback;

    if (!fallback?.message) {
      this.logger.warn(`Falha no fluxo sem fallback configurado: ${reason}`);
      return;
    }

    const fallbackMsg = await this.interpolateVariables(fallback.message, conversationId);
    const result = await this.messaging.sendTextMessage(channel, from, fallbackMsg);
    await this.conversationService.saveMessage(
      conversationId,
      'OUTBOUND',
      fallbackMsg,
      result?.messageId,
    );

    if (fallback.goto) {
      await this.executeGoto(bot.id, channel, from, conversationId, fallback.goto);
    }
  }

  private async processConfiguredFlowStep(
    bot: any,
    channel: ChannelConfig,
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
          channel,
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
          channel,
          from,
          conversation.id,
          step.keywordTrigger,
        );

        // Se a keyword tem captura de variável, iniciar captura
        if (captureVariable) {
          await this.startVariableCapture(
            bot.id,
            channel,
            from,
            conversation.id,
            captureVariable,
            nextGoto,
          );
        } else if (nextGoto) {
          await this.executeGoto(
            bot.id,
            channel,
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
      await this.executeFallback(bot, channel, from, conversation.id, error.message);
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

      const channel = MessagingService.fromChannel(bot.whatsappChannel);
      await this.messaging.markAsRead(channel, messageId);

      const conversation = await this.conversationService.getOrCreate(
        botId,
        from,
        contactName,
      );

      // Salva/atualiza contato automaticamente
      this.contactService.upsertFromConversation(botId, from, contactName).catch((err) =>
        this.logger.warn(`Falha ao salvar contato ${from}: ${err.message}`),
      );

      // Atualiza métricas do lead
      this.leadService.updateMetricsFromMessage(botId, from).catch((err) =>
        this.logger.warn(`Falha ao atualizar métricas do lead ${from}: ${err.message}`),
      );

      // Construir contexto da conversa (cache ou DB)
      const context = await this.getOrBuildContext(conversation);

      const isFirstInteraction = context.messageCount === 0;

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

      // Se a conversa está encerrada (CLOSED), reabrir como nova conversa
      if (conversation.status === 'CLOSED') {
        await this.prisma.conversation.update({
          where: { id: conversation.id },
          data: { status: 'BOT', isActive: true, flowStepIndex: 0 },
        });
        this.contextCache.invalidate(conversation.id);
        conversation.status = 'BOT';
        context.status = 'BOT';
        // Tratar como primeira interação novamente
        const flow = this.parseFlowConfig(bot.flowConfig);
        if (flow.initialInteraction) {
          try {
            await this.executeGoto(bot.id, channel, from, conversation.id, flow.initialInteraction);
            return;
          } catch (error) {
            this.logger.warn(`Falha ao executar initialInteraction após reabrir: ${error.message}`);
            await this.executeFallback(bot, channel, from, conversation.id, error.message);
            return;
          }
        }
      }

      // Verificar se há captura de variável pendente
      const handledByCapture = await this.processVariableCapture(bot, channel, from, conversation, text);
      if (handledByCapture) return;

      // Primeira interação: usar initialInteraction (goto) ou initialMessage (texto legado)
      if (isFirstInteraction) {
        const flow = this.parseFlowConfig(bot.flowConfig);

        if (flow.initialInteraction) {
          try {
            await this.executeGoto(bot.id, channel, from, conversation.id, flow.initialInteraction);
            return;
          } catch (error) {
            this.logger.warn(`Falha ao executar initialInteraction: ${error.message}`);
            await this.executeFallback(bot, channel, from, conversation.id, error.message);
            return;
          }
        } else if (bot.initialMessage) {
          const initialResult = await this.messaging.sendTextMessage(channel, from, bot.initialMessage);
          await this.conversationService.saveMessage(
            conversation.id,
            'OUTBOUND',
            bot.initialMessage,
            initialResult?.messageId,
          );
        }
      }

      const handledByFlow = await this.processConfiguredFlowStep(bot, channel, from, conversation);
      if (handledByFlow) return;

      const menuMatch = await this.menuService.findMenuMatch(botId, text);
      if (menuMatch) {
        const { menu } = menuMatch;
        await this.sendMenu(botId, channel, from, conversation.id, menu.trigger);
        return;
      }

      const optionMatch = await this.menuService.findOptionResponse(botId, text);
      if (optionMatch) {
        if (optionMatch.option.goto) {
          await this.executeGoto(botId, channel, from, conversation.id, optionMatch.option.goto);
          return;
        }

        const responseText = `Você selecionou: ${optionMatch.option.title}`;
        const result = await this.messaging.sendTextMessage(channel, from, responseText);
        await this.conversationService.saveMessage(
          conversation.id,
          'OUTBOUND',
          responseText,
          result?.messageId,
        );
        return;
      }

      // Keyword match com suporte a goto e captureVariable
      let responseText: string | null = null;

      switch (bot.responseMode) {
        case 'KEYWORDS': {
          const match = await this.keywordService.findMatch(botId, text);
          if (match) {
            responseText = await this.interpolateVariables(match.response, conversation.id, context);
            const result = await this.messaging.sendTextMessage(channel, from, responseText);
            await this.conversationService.saveMessage(
              conversation.id,
              'OUTBOUND',
              responseText,
              result?.messageId,
            );

            // Se tiver captureVariable, iniciar captura (goto executará após captura)
            if (match.captureVariable) {
              await this.startVariableCapture(botId, channel, from, conversation.id, match.captureVariable, match.goto);
              return;
            }

            // Se tiver goto, navegar
            if (match.goto) {
              await this.executeGoto(botId, channel, from, conversation.id, match.goto);
            }
            return;
          }

          // Usar fallback configurado (que pode redirecionar para um menu via goto)
          const flow = this.parseFlowConfig(bot.flowConfig);
          if (flow.fallback?.message || flow.fallback?.goto) {
            await this.executeFallback(bot, channel, from, conversation.id, 'Nenhuma keyword encontrada');
            return;
          }

          // Se não há fallback configurado, tentar reenviar o menu inicial
          if (flow.initialInteraction) {
            try {
              await this.executeGoto(bot.id, channel, from, conversation.id, flow.initialInteraction);
              return;
            } catch (error) {
              this.logger.warn(`Falha ao reenviar menu inicial: ${error.message}`);
            }
          }

          responseText = 'Desculpe, não entendi. Tente reformular sua pergunta.';
          break;
        }

        case 'AI':
          responseText = await this.generateAIResponse(bot, conversation.id, text, context);
          break;

        case 'HYBRID': {
          const match = await this.keywordService.findMatch(botId, text);
          if (match) {
            responseText = await this.interpolateVariables(match.response, conversation.id, context);
            const result = await this.messaging.sendTextMessage(channel, from, responseText);
            await this.conversationService.saveMessage(
              conversation.id,
              'OUTBOUND',
              responseText,
              result?.messageId,
            );

            if (match.captureVariable) {
              await this.startVariableCapture(botId, channel, from, conversation.id, match.captureVariable, match.goto);
              return;
            }

            if (match.goto) {
              await this.executeGoto(botId, channel, from, conversation.id, match.goto);
            }
            return;
          }

          // No modo HYBRID, a IA responde perguntas fora do fluxo e guia o usuário de volta
          const hybridFlow = this.parseFlowConfig(bot.flowConfig);
          let hybridFlowHint = 'Guie o usuário de volta ao atendimento.';

          // Construir dica sobre o fluxo disponível para a IA
          const availableKeywords = await this.prisma.keyword.findMany({
            where: { botId, isActive: true },
            select: { trigger: true },
          });
          if (availableKeywords.length > 0) {
            const triggers = availableKeywords.map((k) => k.trigger).join(', ');
            hybridFlowHint = `Os tópicos disponíveis no fluxo do bot são: ${triggers}. Sugira ao usuário que digite uma dessas opções para continuar o atendimento.`;
          }
          if (hybridFlow.initialInteraction) {
            hybridFlowHint += ' Ou sugira que o usuário digite "menu" ou "início" para voltar ao menu principal.';
          }

          responseText = await this.generateAIResponse(bot, conversation.id, text, context, hybridFlowHint);
          break;
        }
      }

      if (responseText) {
        const interpolated = await this.interpolateVariables(responseText, conversation.id, context);
        const result = await this.messaging.sendTextMessage(channel, from, interpolated);

        await this.conversationService.saveMessage(
          conversation.id,
          'OUTBOUND',
          interpolated,
          result?.messageId,
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
        include: { whatsappChannel: true, aiConfig: true },
      });

      if (!bot || !bot.isActive || !bot.whatsappChannel) return;

      const channel = MessagingService.fromChannel(bot.whatsappChannel);
      await this.messaging.markAsRead(channel, messageId);

      const conversation = await this.conversationService.getOrCreate(botId, from, contactName);

      // Salva/atualiza contato automaticamente
      this.contactService.upsertFromConversation(botId, from, contactName).catch((err) =>
        this.logger.warn(`Falha ao salvar contato ${from}: ${err.message}`),
      );

      // Atualiza métricas do lead
      this.leadService.updateMetricsFromMessage(botId, from).catch((err) =>
        this.logger.warn(`Falha ao atualizar métricas do lead ${from}: ${err.message}`),
      );

      // Verificar se é primeira interação (antes de salvar a mensagem)
      const conversationMessagesCount = await this.prisma.message.count({
        where: { conversationId: conversation.id },
      });
      const isFirstInteraction = conversationMessagesCount === 0;

      await this.conversationService.saveMessage(
        conversation.id,
        'INBOUND',
        `[${selectedTitle}]`,
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

      // Se a conversa está encerrada (CLOSED), reabrir como nova conversa
      if (conversation.status === 'CLOSED') {
        await this.prisma.conversation.update({
          where: { id: conversation.id },
          data: { status: 'BOT', isActive: true, flowStepIndex: 0 },
        });
        this.contextCache.invalidate(conversation.id);
        conversation.status = 'BOT';
        const flow = this.parseFlowConfig(bot.flowConfig);
        if (flow.initialInteraction) {
          try {
            await this.executeGoto(bot.id, channel, from, conversation.id, flow.initialInteraction);
            return;
          } catch (error) {
            this.logger.warn(`Falha ao executar initialInteraction após reabrir: ${error.message}`);
          }
        }
      }

      // Se a conversa está aguardando variável, a seleção interativa pode ser usada como valor
      const handledByCapture = await this.processVariableCapture(bot, channel, from, conversation, selectedTitle);
      if (handledByCapture) return;

      // Primeira interação: usar initialInteraction (goto) ou initialMessage (texto legado)
      if (isFirstInteraction) {
        const flow = this.parseFlowConfig(bot.flowConfig);

        if (flow.initialInteraction) {
          try {
            await this.executeGoto(bot.id, channel, from, conversation.id, flow.initialInteraction);
            return;
          } catch (error) {
            this.logger.warn(`Falha ao executar initialInteraction: ${error.message}`);
            await this.executeFallback(bot, channel, from, conversation.id, error.message);
            return;
          }
        } else if (bot.initialMessage) {
          const initialResult = await this.messaging.sendTextMessage(channel, from, bot.initialMessage);
          await this.conversationService.saveMessage(
            conversation.id,
            'OUTBOUND',
            bot.initialMessage,
            initialResult?.messageId,
          );
        }
      }

      // Processar flow steps configurados
      const handledByFlow = await this.processConfiguredFlowStep(bot, channel, from, conversation);
      if (handledByFlow) return;

      const optionMatch = await this.menuService.findOptionResponse(botId, selectedId);
      if (optionMatch?.option.goto) {
        try {
          await this.executeGoto(botId, channel, from, conversation.id, optionMatch.option.goto);
        } catch (error) {
          await this.executeFallback(bot, channel, from, conversation.id, error.message);
        }
        return;
      }

      // Se encontrou a opção mas sem goto, mostrar resposta
      if (optionMatch) {
        const responseText = `Você selecionou: ${optionMatch.option.title}${optionMatch.option.description ? '\n' + optionMatch.option.description : ''}`;
        const result = await this.messaging.sendTextMessage(channel, from, responseText);
        await this.conversationService.saveMessage(
          conversation.id,
          'OUTBOUND',
          responseText,
          result?.messageId,
        );
        return;
      }

      // Fallback: tentar match por keyword usando o título selecionado
      const menuMatch = await this.menuService.findMenuMatch(botId, selectedTitle);
      if (menuMatch) {
        const { menu } = menuMatch;
        await this.sendMenu(botId, channel, from, conversation.id, menu.trigger);
        return;
      }

      const keywordOptionMatch = await this.menuService.findOptionResponse(botId, selectedTitle);
      if (keywordOptionMatch?.option.goto) {
        await this.executeGoto(botId, channel, from, conversation.id, keywordOptionMatch.option.goto);
        return;
      }

      // Último fallback: processar como mensagem de texto comum
      switch (bot.responseMode) {
        case 'KEYWORDS': {
          const match = await this.keywordService.findMatch(botId, selectedTitle);
          if (match) {
            const responseText = await this.interpolateVariables(match.response, conversation.id);
            const result = await this.messaging.sendTextMessage(channel, from, responseText);
            await this.conversationService.saveMessage(
              conversation.id,
              'OUTBOUND',
              responseText,
              result?.messageId,
            );

            if (match.captureVariable) {
              await this.startVariableCapture(botId, channel, from, conversation.id, match.captureVariable, match.goto);
              return;
            }

            if (match.goto) {
              await this.executeGoto(botId, channel, from, conversation.id, match.goto);
            }
            return;
          }

          // Usar fallback configurado (pode redirecionar para menu via goto)
          const flow = this.parseFlowConfig(bot.flowConfig);
          if (flow.fallback?.message || flow.fallback?.goto) {
            await this.executeFallback(bot, channel, from, conversation.id, 'Nenhuma keyword encontrada');
            return;
          }

          // Se não há fallback, tentar reenviar o menu inicial
          if (flow.initialInteraction) {
            try {
              await this.executeGoto(bot.id, channel, from, conversation.id, flow.initialInteraction);
              return;
            } catch (error) {
              this.logger.warn(`Falha ao reenviar menu inicial: ${error.message}`);
            }
          }
          break;
        }

        case 'AI': {
          const responseText = await this.generateAIResponse(bot, conversation.id, selectedTitle);
          if (responseText) {
            const interpolated = await this.interpolateVariables(responseText, conversation.id);
            const result = await this.messaging.sendTextMessage(channel, from, interpolated);
            await this.conversationService.saveMessage(
              conversation.id,
              'OUTBOUND',
              interpolated,
              result?.messageId,
            );
          }
          return;
        }

        case 'HYBRID': {
          const match = await this.keywordService.findMatch(botId, selectedTitle);
          if (match) {
            const responseText = await this.interpolateVariables(match.response, conversation.id);
            const result = await this.messaging.sendTextMessage(channel, from, responseText);
            await this.conversationService.saveMessage(
              conversation.id,
              'OUTBOUND',
              responseText,
              result?.messageId,
            );

            if (match.captureVariable) {
              await this.startVariableCapture(botId, channel, from, conversation.id, match.captureVariable, match.goto);
              return;
            }

            if (match.goto) {
              await this.executeGoto(botId, channel, from, conversation.id, match.goto);
            }
            return;
          }

          const aiResponse = await this.generateAIResponse(bot, conversation.id, selectedTitle);
          if (aiResponse) {
            const interpolated = await this.interpolateVariables(aiResponse, conversation.id);
            const result = await this.messaging.sendTextMessage(channel, from, interpolated);
            await this.conversationService.saveMessage(
              conversation.id,
              'OUTBOUND',
              interpolated,
              result?.messageId,
            );
          }
          return;
        }
      }

      // Se nenhum handler processou, enviar texto genérico
      const responseText = `Opção selecionada: ${selectedTitle}`;
      const result = await this.messaging.sendTextMessage(channel, from, responseText);
      await this.conversationService.saveMessage(
        conversation.id,
        'OUTBOUND',
        responseText,
        result?.messageId,
      );
    } catch (error) {
      this.logger.error(`Erro processando resposta interativa: ${error.message}`, error.stack);
    }
  }

  // ─── Emulador ───

  /**
   * Processa uma mensagem do emulador usando o mesmo pipeline do WhatsApp real.
   * Usa EMULATOR_CHANNEL para não enviar mensagens reais.
   * Retorna as mensagens outbound geradas pelo processamento.
   */
  async processEmulatorMessage(
    botId: string,
    text: string,
    sessionPhone: string,
  ): Promise<{
    messages: Array<{ content: string; direction: string; senderType: string; createdAt: Date }>;
    conversationId: string;
    status: string;
    variables: Record<string, { name: string; type: string; value: string }>;
  }> {
    const bot = await this.prisma.bot.findUnique({
      where: { id: botId },
      include: { whatsappChannel: true, aiConfig: true },
    });

    if (!bot || !bot.isActive) {
      throw new Error(`Bot ${botId} não encontrado ou inativo`);
    }

    const channel = EMULATOR_CHANNEL;
    const emulatorPhone = `emu_${sessionPhone}`;

    const conversation = await this.conversationService.getOrCreate(
      botId,
      emulatorPhone,
      'Emulador',
    );

    // Contar mensagens ANTES do processamento
    const messageCountBefore = await this.prisma.message.count({
      where: { conversationId: conversation.id },
    });

    // Salvar contexto e processar usando o pipeline real
    const context = await this.getOrBuildContext(conversation);
    const isFirstInteraction = context.messageCount === 0;

    await this.conversationService.saveMessage(
      conversation.id,
      'INBOUND',
      text,
      `emu_in_${Date.now()}`,
      'CONTACT',
    );

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });

    // Se conversa encerrada, reabrir
    if (conversation.status === 'CLOSED') {
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { status: 'BOT', isActive: true, flowStepIndex: 0 },
      });
      this.contextCache.invalidate(conversation.id);
      conversation.status = 'BOT';
      context.status = 'BOT';
      const flow = this.parseFlowConfig(bot.flowConfig);
      if (flow.initialInteraction) {
        try {
          await this.executeGoto(bot.id, channel, emulatorPhone, conversation.id, flow.initialInteraction);
        } catch (error) {
          this.logger.warn(`Emulador: falha initialInteraction após reabrir: ${error.message}`);
          await this.executeFallback(bot, channel, emulatorPhone, conversation.id, error.message);
        }
        return this.collectEmulatorResponse(conversation.id, messageCountBefore);
      }
    }

    // Se conversa em modo humano, não processar
    if (conversation.status === 'HUMAN') {
      return this.collectEmulatorResponse(conversation.id, messageCountBefore);
    }

    // Captura de variável pendente
    const handledByCapture = await this.processVariableCapture(bot, channel, emulatorPhone, conversation, text);
    if (handledByCapture) {
      return this.collectEmulatorResponse(conversation.id, messageCountBefore);
    }

    // Primeira interação
    if (isFirstInteraction) {
      const flow = this.parseFlowConfig(bot.flowConfig);
      if (flow.initialInteraction) {
        try {
          await this.executeGoto(bot.id, channel, emulatorPhone, conversation.id, flow.initialInteraction);
        } catch (error) {
          this.logger.warn(`Emulador: falha initialInteraction: ${error.message}`);
          await this.executeFallback(bot, channel, emulatorPhone, conversation.id, error.message);
        }
        return this.collectEmulatorResponse(conversation.id, messageCountBefore);
      } else if (bot.initialMessage) {
        const initialResult = await this.messaging.sendTextMessage(channel, emulatorPhone, bot.initialMessage);
        await this.conversationService.saveMessage(
          conversation.id,
          'OUTBOUND',
          bot.initialMessage,
          initialResult?.messageId,
        );
      }
    }

    // Flow steps
    const handledByFlow = await this.processConfiguredFlowStep(bot, channel, emulatorPhone, conversation);
    if (handledByFlow) {
      return this.collectEmulatorResponse(conversation.id, messageCountBefore);
    }

    // Menu match
    const menuMatch = await this.menuService.findMenuMatch(botId, text);
    if (menuMatch) {
      await this.sendMenu(botId, channel, emulatorPhone, conversation.id, menuMatch.menu.trigger);
      return this.collectEmulatorResponse(conversation.id, messageCountBefore);
    }

    // Option match
    const optionMatch = await this.menuService.findOptionResponse(botId, text);
    if (optionMatch) {
      if (optionMatch.option.goto) {
        await this.executeGoto(botId, channel, emulatorPhone, conversation.id, optionMatch.option.goto);
      } else {
        const responseText = `Você selecionou: ${optionMatch.option.title}`;
        const result = await this.messaging.sendTextMessage(channel, emulatorPhone, responseText);
        await this.conversationService.saveMessage(conversation.id, 'OUTBOUND', responseText, result?.messageId);
      }
      return this.collectEmulatorResponse(conversation.id, messageCountBefore);
    }

    // Keyword/AI/Hybrid
    let responseText: string | null = null;

    switch (bot.responseMode) {
      case 'KEYWORDS': {
        const match = await this.keywordService.findMatch(botId, text);
        if (match) {
          responseText = await this.interpolateVariables(match.response, conversation.id, context);
          const result = await this.messaging.sendTextMessage(channel, emulatorPhone, responseText);
          await this.conversationService.saveMessage(conversation.id, 'OUTBOUND', responseText, result?.messageId);

          if (match.captureVariable) {
            await this.startVariableCapture(botId, channel, emulatorPhone, conversation.id, match.captureVariable, match.goto);
            return this.collectEmulatorResponse(conversation.id, messageCountBefore);
          }
          if (match.goto) {
            await this.executeGoto(botId, channel, emulatorPhone, conversation.id, match.goto);
          }
          return this.collectEmulatorResponse(conversation.id, messageCountBefore);
        }

        const flow = this.parseFlowConfig(bot.flowConfig);
        if (flow.fallback?.message || flow.fallback?.goto) {
          await this.executeFallback(bot, channel, emulatorPhone, conversation.id, 'Nenhuma keyword encontrada');
          return this.collectEmulatorResponse(conversation.id, messageCountBefore);
        }

        if (flow.initialInteraction) {
          try {
            await this.executeGoto(bot.id, channel, emulatorPhone, conversation.id, flow.initialInteraction);
            return this.collectEmulatorResponse(conversation.id, messageCountBefore);
          } catch (error) {
            this.logger.warn(`Emulador: falha ao reenviar menu: ${error.message}`);
          }
        }

        responseText = 'Desculpe, não entendi. Tente reformular sua pergunta.';
        break;
      }

      case 'AI':
        responseText = await this.generateAIResponse(bot, conversation.id, text, context);
        break;

      case 'HYBRID': {
        const match = await this.keywordService.findMatch(botId, text);
        if (match) {
          responseText = await this.interpolateVariables(match.response, conversation.id, context);
          const result = await this.messaging.sendTextMessage(channel, emulatorPhone, responseText);
          await this.conversationService.saveMessage(conversation.id, 'OUTBOUND', responseText, result?.messageId);

          if (match.captureVariable) {
            await this.startVariableCapture(botId, channel, emulatorPhone, conversation.id, match.captureVariable, match.goto);
            return this.collectEmulatorResponse(conversation.id, messageCountBefore);
          }
          if (match.goto) {
            await this.executeGoto(botId, channel, emulatorPhone, conversation.id, match.goto);
          }
          return this.collectEmulatorResponse(conversation.id, messageCountBefore);
        }

        const hybridFlow = this.parseFlowConfig(bot.flowConfig);
        let hybridFlowHint = 'Guie o usuário de volta ao atendimento.';

        const availableKeywords = await this.prisma.keyword.findMany({
          where: { botId, isActive: true },
          select: { trigger: true },
        });
        if (availableKeywords.length > 0) {
          const triggers = availableKeywords.map((k) => k.trigger).join(', ');
          hybridFlowHint = `Os tópicos disponíveis no fluxo do bot são: ${triggers}. Sugira ao usuário que digite uma dessas opções para continuar o atendimento.`;
        }
        if (hybridFlow.initialInteraction) {
          hybridFlowHint += ' Ou sugira que o usuário digite "menu" ou "início" para voltar ao menu principal.';
        }

        responseText = await this.generateAIResponse(bot, conversation.id, text, context, hybridFlowHint);
        break;
      }
    }

    if (responseText) {
      const interpolated = await this.interpolateVariables(responseText, conversation.id, context);
      const result = await this.messaging.sendTextMessage(channel, emulatorPhone, interpolated);
      await this.conversationService.saveMessage(conversation.id, 'OUTBOUND', interpolated, result?.messageId);
    }

    return this.collectEmulatorResponse(conversation.id, messageCountBefore);
  }

  /** Reseta a conversa do emulador */
  async resetEmulatorConversation(botId: string, sessionPhone: string) {
    const emulatorPhone = `emu_${sessionPhone}`;
    const conversation = await this.prisma.conversation.findUnique({
      where: { botId_contactPhone: { botId, contactPhone: emulatorPhone } },
    });

    if (conversation) {
      await this.prisma.message.deleteMany({ where: { conversationId: conversation.id } });
      await this.prisma.conversationVariable.deleteMany({ where: { conversationId: conversation.id } });
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          status: 'BOT',
          isActive: true,
          flowStepIndex: 0,
          waitingForVariable: false,
          pendingVariableName: null,
          pendingVariableType: null,
          pendingVariableGoto: Prisma.JsonNull,
        },
      });
      this.contextCache.invalidate(conversation.id);
    }

    return { success: true };
  }

  /** Coleta as mensagens outbound geradas pelo processamento do emulador */
  private async collectEmulatorResponse(
    conversationId: string,
    messageCountBefore: number,
  ) {
    // Buscar todas as mensagens novas (após o processamento)
    const allMessages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      skip: messageCountBefore,
    });

    // Filtrar apenas outbound (respostas do bot)
    const outboundMessages = allMessages
      .filter((m) => m.direction === 'OUTBOUND')
      .map((m) => ({
        content: m.content,
        direction: m.direction,
        senderType: m.senderType,
        createdAt: m.createdAt,
      }));

    // Buscar estado atual da conversa
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    // Buscar variáveis
    const variables = await this.prisma.conversationVariable.findMany({
      where: { conversationId },
    });
    const variablesMap: Record<string, { name: string; type: string; value: string }> = {};
    for (const v of variables) {
      variablesMap[v.name] = { name: v.name, type: v.type, value: v.value };
    }

    return {
      messages: outboundMessages,
      conversationId,
      status: conversation?.status || 'BOT',
      variables: variablesMap,
    };
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

      // Try both dialog360MsgId and externalMsgId
      await this.prisma.message.updateMany({
        where: {
          OR: [
            { dialog360MsgId: messageId },
            { externalMsgId: messageId },
          ],
        },
        data: { status: mappedStatus },
      });
    } catch (error) {
      this.logger.error(`Erro atualizando status: ${error.message}`);
    }
  }
}
