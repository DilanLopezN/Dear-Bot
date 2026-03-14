import { Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationService } from '../conversation/conversation.service';
import { Dialog360Service } from '../services/dialog360.service';

@Injectable()
export class ChatManagementService {
  private readonly logger = new Logger(ChatManagementService.name);

  constructor(
    private prisma: PrismaService,
    private conversationService: ConversationService,
    private dialog360: Dialog360Service,
  ) {}

  /** Lista todos os chats ativos dos bots do usuário */
  async listChats(
    userId: string,
    filters: {
      botId?: string;
      minWaitMinutes?: number;
      status?: string;
    },
  ) {
    const where: any = {
      bot: { userId },
      isActive: true,
    };

    if (filters.botId) {
      where.botId = filters.botId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.minWaitMinutes) {
      const threshold = new Date(Date.now() - filters.minWaitMinutes * 60 * 1000);
      where.lastMessageAt = { lte: threshold };
    }

    const conversations = await this.prisma.conversation.findMany({
      where,
      include: {
        bot: { select: { id: true, name: true, responseMode: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { messages: true } },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    return conversations.map((conv) => ({
      id: conv.id,
      botId: conv.botId,
      botName: conv.bot.name,
      botResponseMode: conv.bot.responseMode,
      contactPhone: conv.contactPhone,
      contactName: conv.contactName,
      status: conv.status,
      humanTakeoverAt: conv.humanTakeoverAt,
      lastMessageAt: conv.lastMessageAt,
      messageCount: conv._count.messages,
      lastMessage: conv.messages[0] || null,
      createdAt: conv.createdAt,
    }));
  }

  /** Busca mensagens de uma conversa (com verificação de ownership) */
  async getMessages(userId: string, conversationId: string, take = 100) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { bot: { select: { userId: true } } },
    });

    if (!conversation) throw new NotFoundException('Conversa não encontrada');
    if (conversation.bot.userId !== userId) throw new ForbiddenException();

    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take,
    });
  }

  /** Assume o atendimento de uma conversa */
  async takeoverChat(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { bot: { select: { userId: true } } },
    });

    if (!conversation) throw new NotFoundException('Conversa não encontrada');
    if (conversation.bot.userId !== userId) throw new ForbiddenException();

    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: 'HUMAN',
        humanTakeoverAt: new Date(),
      },
    });
  }

  /** Devolve o atendimento para o bot */
  async releaseChat(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { bot: { select: { userId: true } } },
    });

    if (!conversation) throw new NotFoundException('Conversa não encontrada');
    if (conversation.bot.userId !== userId) throw new ForbiddenException();

    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: 'BOT',
        humanTakeoverAt: null,
      },
    });
  }

  /** Envia mensagem como atendente humano */
  async sendMessage(userId: string, conversationId: string, content: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        bot: {
          select: { userId: true, id: true },
          include: { whatsappChannel: true },
        },
      },
    });

    if (!conversation) throw new NotFoundException('Conversa não encontrada');
    if (conversation.bot.userId !== userId) throw new ForbiddenException();
    if (conversation.status !== 'HUMAN') {
      throw new ForbiddenException('Você precisa assumir o atendimento antes de enviar mensagens');
    }

    const apiKey = conversation.bot.whatsappChannel?.dialog360ApiKey;
    if (!apiKey) throw new NotFoundException('Canal WhatsApp não configurado');

    const result = await this.dialog360.sendTextMessage(
      apiKey,
      conversation.contactPhone,
      content,
    );

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        direction: 'OUTBOUND',
        content,
        senderType: 'HUMAN',
        dialog360MsgId: result?.messages?.[0]?.id,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    return message;
  }
}
