import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationService } from '../conversation/conversation.service';
import { KeywordService } from '../keyword/keyword.service';
import { MenuService } from '../menu/menu.service';
import { ClaudeService } from '../services/claude.service';
import { Dialog360Service } from '../services/dialog360.service';

type MessageStatus = 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private prisma: PrismaService,
    private conversationService: ConversationService,
    private keywordService: KeywordService,
    private menuService: MenuService,
    private claudeService: ClaudeService,
    private dialog360: Dialog360Service,
  ) {}

  async processIncomingMessage(
    botId: string,
    from: string,
    text: string,
    messageId: string,
    contactName?: string,
  ) {
    try {
      // 1. Busca o bot e canal
      const bot = await this.prisma.bot.findUnique({
        where: { id: botId },
        include: { whatsappChannel: true },
      });

      if (!bot || !bot.isActive || !bot.whatsappChannel) {
        this.logger.warn(`Bot ${botId} não encontrado ou inativo`);
        return;
      }

      const apiKey = bot.whatsappChannel.dialog360ApiKey;

      // 2. Marca como lida
      await this.dialog360.markAsRead(apiKey, messageId);

      // 3. Busca/cria conversa
      const conversation = await this.conversationService.getOrCreate(
        botId,
        from,
        contactName,
      );

      // 4. Salva mensagem recebida
      await this.conversationService.saveMessage(
        conversation.id,
        'INBOUND',
        text,
        messageId,
      );

      // 5. Check for interactive menu match first (works in all modes)
      const menuMatch = await this.menuService.findMenuMatch(botId, text);
      if (menuMatch) {
        const { menu, options } = menuMatch;
        // Send interactive list message via Dialog360
        const result = await this.dialog360.sendInteractiveListMessage(
          apiKey,
          from,
          menu.title,
          menu.body || menu.title,
          menu.footer || undefined,
          'Ver opções',
          [{ title: menu.title, rows: options.map((o) => ({ id: o.id, title: o.title, description: o.description })) }],
        );

        const menuText = `📋 ${menu.title}\n${options.map((o, i) => `${i + 1}. ${o.title}${o.description ? ' - ' + o.description : ''}`).join('\n')}`;
        await this.conversationService.saveMessage(
          conversation.id,
          'OUTBOUND',
          menuText,
          result?.messages?.[0]?.id,
        );
        return;
      }

      // 6. Check if this is a menu option response
      const optionMatch = await this.menuService.findOptionResponse(botId, text);
      if (optionMatch) {
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

      // 7. Gera resposta baseado no modo do bot
      let responseText: string | null = null;

      switch (bot.responseMode) {
        case 'KEYWORDS':
          responseText = await this.keywordService.findMatch(botId, text);
          if (!responseText) {
            responseText = 'Desculpe, não entendi. Tente reformular sua pergunta.';
          }
          break;

        case 'AI':
          responseText = await this.claudeService.generateResponse(
            conversation.id,
            text,
            bot.systemPrompt || undefined,
          );
          break;

        case 'HYBRID':
          // Primeiro tenta keyword, se não achar usa IA
          responseText = await this.keywordService.findMatch(botId, text);
          if (!responseText) {
            responseText = await this.claudeService.generateResponse(
              conversation.id,
              text,
              bot.systemPrompt || undefined,
            );
          }
          break;
      }

      // 8. Envia resposta via Dialog360
      if (responseText) {
        const result = await this.dialog360.sendTextMessage(apiKey, from, responseText);

        // 9. Salva mensagem enviada
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

  /** Process interactive message responses (button replies and list selections) */
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

      // Save the user's selection as an inbound message
      await this.conversationService.saveMessage(
        conversation.id,
        'INBOUND',
        `[${selectedTitle}]`,
        messageId,
      );

      // Find the option and respond
      const optionMatch = await this.menuService.findOptionResponse(botId, selectedId);
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
