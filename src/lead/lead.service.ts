import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadTemperature } from '@prisma/client';

@Injectable()
export class LeadService {
  private readonly logger = new Logger(LeadService.name);

  constructor(private prisma: PrismaService) {}

  private async ensureBotOwnership(botId: string, userId: string) {
    const bot = await this.prisma.bot.findFirst({ where: { id: botId, userId } });
    if (!bot) throw new NotFoundException('Bot não encontrado');
    return bot;
  }

  async create(botId: string, userId: string, dto: CreateLeadDto) {
    await this.ensureBotOwnership(botId, userId);

    const contact = await this.prisma.contact.findFirst({
      where: { id: dto.contactId, botId },
    });
    if (!contact) throw new NotFoundException('Contato não encontrado');

    const existing = await this.prisma.lead.findUnique({
      where: { contactId: dto.contactId },
    });
    if (existing) throw new ConflictException('Lead já existe para este contato');

    const lead = await this.prisma.lead.create({
      data: {
        botId,
        contactId: dto.contactId,
        status: dto.status || 'NEW',
        source: dto.source,
        estimatedValue: dto.estimatedValue,
        notes: dto.notes,
      },
      include: { contact: true },
    });

    await this.recalculateScore(lead.id);

    return this.prisma.lead.findUnique({
      where: { id: lead.id },
      include: { contact: true },
    });
  }

  async findAll(
    botId: string,
    userId: string,
    filters: {
      search?: string;
      status?: string;
      temperature?: string;
      sortBy?: string;
    } = {},
  ) {
    await this.ensureBotOwnership(botId, userId);

    const where: any = { botId };

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.temperature) {
      where.temperature = filters.temperature;
    }
    if (filters.search) {
      where.contact = {
        OR: [
          { phone: { contains: filters.search, mode: 'insensitive' } },
          { name: { contains: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } },
        ],
      };
    }

    let orderBy: any;
    switch (filters.sortBy) {
      case 'score':
        orderBy = { score: 'desc' };
        break;
      case 'recent':
        orderBy = { lastInteractionAt: 'desc' };
        break;
      case 'value':
        orderBy = { estimatedValue: 'desc' };
        break;
      case 'name':
        orderBy = { contact: { name: 'asc' } };
        break;
      default:
        orderBy = { score: 'desc' };
    }

    return this.prisma.lead.findMany({
      where,
      include: { contact: true },
      orderBy,
    });
  }

  async findOne(botId: string, userId: string, id: string) {
    await this.ensureBotOwnership(botId, userId);
    const lead = await this.prisma.lead.findFirst({
      where: { id, botId },
      include: {
        contact: true,
        history: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!lead) throw new NotFoundException('Lead não encontrado');
    return lead;
  }

  async update(botId: string, userId: string, id: string, dto: UpdateLeadDto) {
    const lead = await this.findOne(botId, userId, id);

    const data: any = {};
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.source !== undefined) data.source = dto.source;
    if (dto.estimatedValue !== undefined) data.estimatedValue = dto.estimatedValue;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.lostReason !== undefined) data.lostReason = dto.lostReason;

    if (dto.status === 'CONVERTED') {
      data.convertedAt = new Date();
    }

    // Registrar mudança de status no histórico
    if (dto.status && dto.status !== lead.status) {
      await this.prisma.leadHistory.create({
        data: {
          leadId: id,
          action: 'status_change',
          details: JSON.stringify({ from: lead.status, to: dto.status }),
        },
      });
    }

    if (dto.notes && dto.notes !== lead.notes) {
      await this.prisma.leadHistory.create({
        data: {
          leadId: id,
          action: 'note_added',
          details: dto.notes,
        },
      });
    }

    return this.prisma.lead.update({
      where: { id },
      data,
      include: { contact: true },
    });
  }

  async remove(botId: string, userId: string, id: string) {
    await this.findOne(botId, userId, id);
    await this.prisma.lead.delete({ where: { id } });
    return { message: 'Lead removido com sucesso' };
  }

  async getStats(botId: string, userId: string) {
    await this.ensureBotOwnership(botId, userId);

    const [total, hot, warm, cold, byStatus, scoreAgg] = await Promise.all([
      this.prisma.lead.count({ where: { botId } }),
      this.prisma.lead.count({ where: { botId, temperature: 'HOT' } }),
      this.prisma.lead.count({ where: { botId, temperature: 'WARM' } }),
      this.prisma.lead.count({ where: { botId, temperature: 'COLD' } }),
      this.prisma.lead.groupBy({
        by: ['status'],
        where: { botId },
        _count: true,
      }),
      this.prisma.lead.aggregate({
        where: { botId },
        _avg: { score: true },
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    byStatus.forEach((s) => {
      statusCounts[s.status] = s._count;
    });

    const converted = statusCounts['CONVERTED'] || 0;
    const conversionRate = total > 0 ? (converted / total) * 100 : 0;

    return {
      total,
      hot,
      warm,
      cold,
      byStatus: statusCounts,
      conversionRate: Math.round(conversionRate * 100) / 100,
      avgScore: Math.round((scoreAgg._avg.score || 0) * 100) / 100,
    };
  }

  async syncAllContacts(botId: string, userId: string) {
    await this.ensureBotOwnership(botId, userId);

    const contacts = await this.prisma.contact.findMany({
      where: {
        botId,
        lead: null,
      },
    });

    let created = 0;
    for (const contact of contacts) {
      const lead = await this.prisma.lead.create({
        data: {
          botId,
          contactId: contact.id,
          source: 'whatsapp',
        },
      });
      await this.recalculateScore(lead.id);
      created++;
    }

    return { synced: created, total: contacts.length };
  }

  async recalculateScore(leadId: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { contact: true },
    });
    if (!lead) return;

    const conversations = await this.prisma.conversation.findMany({
      where: { botId: lead.botId, contactPhone: lead.contact.phone },
    });

    const conversationIds = conversations.map((c) => c.id);

    if (conversationIds.length === 0) {
      await this.prisma.lead.update({
        where: { id: leadId },
        data: {
          score: 0,
          temperature: 'COLD',
          totalMessages: 0,
          inboundMessages: 0,
          outboundMessages: 0,
          totalConversations: 0,
          humanTakeovers: 0,
          responseRate: 0,
        },
      });
      return;
    }

    const [messageCounts, totalMessages, firstMsg, lastMsg, readCount] =
      await Promise.all([
        this.prisma.message.groupBy({
          by: ['direction'],
          where: { conversationId: { in: conversationIds } },
          _count: true,
        }),
        this.prisma.message.count({
          where: { conversationId: { in: conversationIds } },
        }),
        this.prisma.message.findFirst({
          where: { conversationId: { in: conversationIds } },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.message.findFirst({
          where: { conversationId: { in: conversationIds } },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.message.count({
          where: {
            conversationId: { in: conversationIds },
            status: 'READ',
          },
        }),
      ]);

    const inbound =
      messageCounts.find((m) => m.direction === 'INBOUND')?._count || 0;
    const outbound =
      messageCounts.find((m) => m.direction === 'OUTBOUND')?._count || 0;
    const totalConversations = conversations.length;
    const humanTakeovers = conversations.filter(
      (c) => c.humanTakeoverAt !== null,
    ).length;

    const responseRate =
      totalConversations > 0
        ? conversations.filter((c) =>
            conversationIds.includes(c.id),
          ).length / totalConversations
        : 0;

    const readRate = totalMessages > 0 ? readCount / totalMessages : 0;

    // Scoring (0-100)
    const now = new Date();
    const lastInteraction = lastMsg?.createdAt;
    let recencyScore = 0;
    if (lastInteraction) {
      const hoursSince =
        (now.getTime() - lastInteraction.getTime()) / (1000 * 60 * 60);
      if (hoursSince <= 24) recencyScore = 15;
      else if (hoursSince <= 168) recencyScore = 10; // 7 days
      else if (hoursSince <= 720) recencyScore = 5; // 30 days
    }

    const score = Math.min(
      100,
      Math.min(inbound * 2, 20) +
        Math.min(totalConversations * 5, 20) +
        Math.round(responseRate * 15) +
        Math.min(humanTakeovers * 10, 20) +
        recencyScore +
        Math.round(readRate * 10),
    );

    let temperature: LeadTemperature;
    if (score >= 70) temperature = 'HOT';
    else if (score >= 40) temperature = 'WARM';
    else temperature = 'COLD';

    await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        score,
        temperature,
        totalMessages,
        inboundMessages: inbound,
        outboundMessages: outbound,
        totalConversations,
        lastInteractionAt: lastMsg?.createdAt || null,
        firstInteractionAt: firstMsg?.createdAt || null,
        responseRate,
        humanTakeovers,
      },
    });
  }

  async updateMetricsFromMessage(botId: string, contactPhone: string) {
    const contact = await this.prisma.contact.findUnique({
      where: { botId_phone: { botId, phone: contactPhone } },
      include: { lead: true },
    });

    if (!contact?.lead) return;

    await this.recalculateScore(contact.lead.id);
  }
}
