import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type MessageDirection = 'INBOUND' | 'OUTBOUND';
type SenderType = 'CONTACT' | 'BOT' | 'HUMAN';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(private prisma: PrismaService) {}

  /** Busca ou cria conversa para um contato */
  async getOrCreate(botId: string, contactPhone: string, contactName?: string) {
    try {
      return await this.prisma.conversation.upsert({
        where: { botId_contactPhone: { botId, contactPhone } },
        update: { contactName: contactName || undefined },
        create: { botId, contactPhone, contactName },
      });
    } catch (err) {
      this.logger.error(`Erro ao buscar/criar conversa para bot ${botId}, telefone ${contactPhone}: ${err.message}`, err.stack);
      throw err;
    }
  }

  /** Lista conversas de um bot */
  async findAllByBot(userId: string, botId: string) {
    this.logger.log(`Listando conversas do bot ${botId}`);
    try {
      return await this.prisma.conversation.findMany({
        where: {
          botId,
          bot: { userId },
        },
        include: {
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          _count: { select: { messages: true } },
        },
        orderBy: { updatedAt: 'desc' },
      });
    } catch (err) {
      this.logger.error(`Erro ao listar conversas do bot ${botId}: ${err.message}`, err.stack);
      throw err;
    }
  }

  /** Busca mensagens de uma conversa */
  async getMessages(conversationId: string, take = 50) {
    try {
      return await this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take,
      });
    } catch (err) {
      this.logger.error(`Erro ao buscar mensagens da conversa ${conversationId}: ${err.message}`, err.stack);
      throw err;
    }
  }

  /** Busca variáveis capturadas de uma conversa */
  async getVariables(conversationId: string) {
    try {
      return await this.prisma.conversationVariable.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
      });
    } catch (err) {
      this.logger.error(`Erro ao buscar variáveis da conversa ${conversationId}: ${err.message}`, err.stack);
      throw err;
    }
  }

  /** Salva mensagem */
  async saveMessage(
    conversationId: string,
    direction: MessageDirection,
    content: string,
    dialog360MsgId?: string,
    senderType?: SenderType,
  ) {
    try {
      const sender = senderType || (direction === 'INBOUND' ? 'CONTACT' : 'BOT');
      return await this.prisma.message.create({
        data: { conversationId, direction, content, dialog360MsgId, senderType: sender },
      });
    } catch (err) {
      this.logger.error(`Erro ao salvar mensagem na conversa ${conversationId} (${direction}): ${err.message}`, err.stack);
      throw err;
    }
  }
}
