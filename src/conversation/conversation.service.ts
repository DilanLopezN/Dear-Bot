import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type MessageDirection = 'INBOUND' | 'OUTBOUND';

@Injectable()
export class ConversationService {
  constructor(private prisma: PrismaService) {}

  /** Busca ou cria conversa para um contato */
  async getOrCreate(botId: string, contactPhone: string, contactName?: string) {
    return this.prisma.conversation.upsert({
      where: { botId_contactPhone: { botId, contactPhone } },
      update: { contactName: contactName || undefined, updatedAt: new Date() },
      create: { botId, contactPhone, contactName },
    });
  }

  /** Lista conversas de um bot */
  async findAllByBot(userId: string, botId: string) {
    return this.prisma.conversation.findMany({
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
  }

  /** Busca mensagens de uma conversa */
  async getMessages(conversationId: string, take = 50) {
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  /** Salva mensagem */
  async saveMessage(
    conversationId: string,
    direction: MessageDirection,
    content: string,
    dialog360MsgId?: string,
  ) {
    return this.prisma.message.create({
      data: { conversationId, direction, content, dialog360MsgId },
    });
  }
}
