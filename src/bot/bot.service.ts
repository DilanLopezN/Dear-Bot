import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBotDto, UpdateBotDto } from './dto/bot.dto';

@Injectable()
export class BotService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateBotDto) {
    return this.prisma.bot.create({
      data: { ...dto, userId },
      include: { whatsappChannel: true },
    });
  }

  async findAll(userId: string) {
    return this.prisma.bot.findMany({
      where: { userId },
      include: { whatsappChannel: true, _count: { select: { keywords: true, conversations: true } } },
    });
  }

  async getDashboardOverview(userId: string) {
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - 6);

    const [totalBots, activeBots, connectedBots, totalConversations, totalMessages, recentBots, messages, conversations] =
      await Promise.all([
        this.prisma.bot.count({ where: { userId } }),
        this.prisma.bot.count({ where: { userId, isActive: true } }),
        this.prisma.bot.count({ where: { userId, whatsappChannel: { isNot: null } } }),
        this.prisma.conversation.count({ where: { bot: { userId } } }),
        this.prisma.message.count({ where: { conversation: { bot: { userId } } } }),
        this.prisma.bot.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            whatsappChannel: true,
            _count: { select: { keywords: true, conversations: true } },
          },
        }),
        this.prisma.message.findMany({
          where: { conversation: { bot: { userId } }, createdAt: { gte: weekStart } },
          select: { createdAt: true },
        }),
        this.prisma.conversation.findMany({
          where: { bot: { userId }, createdAt: { gte: weekStart } },
          select: { createdAt: true },
        }),
      ]);

    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const dayMap = new Map<string, { mensagens: number; conversas: number }>();

    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const key = date.toISOString().slice(0, 10);
      dayMap.set(key, { mensagens: 0, conversas: 0 });
    }

    messages.forEach(({ createdAt }) => {
      const key = createdAt.toISOString().slice(0, 10);
      const slot = dayMap.get(key);
      if (slot) slot.mensagens += 1;
    });

    conversations.forEach(({ createdAt }) => {
      const key = createdAt.toISOString().slice(0, 10);
      const slot = dayMap.get(key);
      if (slot) slot.conversas += 1;
    });

    const dailyMetrics = Array.from(dayMap.entries()).map(([key, values]) => {
      const date = new Date(`${key}T00:00:00.000Z`);
      return {
        name: dayNames[date.getUTCDay()],
        mensagens: values.mensagens,
        conversas: values.conversas,
      };
    });

    return {
      totals: {
        totalBots,
        activeBots,
        connectedBots,
        totalConversations,
        totalMessages,
      },
      recentBots,
      dailyMetrics,
    };
  }

  async findOne(userId: string, botId: string) {
    const bot = await this.prisma.bot.findUnique({
      where: { id: botId },
      include: { whatsappChannel: true, keywords: true },
    });
    if (!bot) throw new NotFoundException('Bot não encontrado');
    if (bot.userId !== userId) throw new ForbiddenException();
    return bot;
  }

  async update(userId: string, botId: string, dto: UpdateBotDto) {
    await this.findOne(userId, botId);
    return this.prisma.bot.update({
      where: { id: botId },
      data: dto,
      include: { whatsappChannel: true },
    });
  }

  async remove(userId: string, botId: string) {
    await this.findOne(userId, botId);
    return this.prisma.bot.delete({ where: { id: botId } });
  }
}
