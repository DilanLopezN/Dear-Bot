import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationService } from '../conversation/conversation.service';
import { KeywordService } from '../keyword/keyword.service';
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

      // 5. Gera resposta baseado no modo do bot
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

      // 6. Envia resposta via Dialog360
      if (responseText) {
        const result = await this.dialog360.sendTextMessage(apiKey, from, responseText);

        // 7. Salva mensagem enviada
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
