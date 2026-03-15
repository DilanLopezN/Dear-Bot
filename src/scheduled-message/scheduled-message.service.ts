import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingService } from '../services/messaging.service';
import { CreateScheduledMessageDto } from './dto/create-scheduled-message.dto';

@Injectable()
export class ScheduledMessageService {
  private readonly logger = new Logger(ScheduledMessageService.name);

  constructor(
    private prisma: PrismaService,
    private messaging: MessagingService,
  ) {}

  private async ensureBotOwnership(botId: string, userId: string) {
    const bot = await this.prisma.bot.findFirst({ where: { id: botId, userId } });
    if (!bot) throw new NotFoundException('Bot não encontrado');
    return bot;
  }

  async create(botId: string, userId: string, dto: CreateScheduledMessageDto) {
    await this.ensureBotOwnership(botId, userId);
    return this.prisma.scheduledMessage.create({
      data: {
        botId,
        phone: dto.phone,
        contactId: dto.contactId ?? null,
        message: dto.message,
        scheduledAt: new Date(dto.scheduledAt),
      },
    });
  }

  async findAll(botId: string, userId: string, status?: string) {
    await this.ensureBotOwnership(botId, userId);
    const where: any = { botId };
    if (status) where.status = status;
    return this.prisma.scheduledMessage.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
      include: { contact: { select: { id: true, name: true, phone: true } } },
    });
  }

  async findOne(botId: string, userId: string, id: string) {
    await this.ensureBotOwnership(botId, userId);
    const msg = await this.prisma.scheduledMessage.findFirst({
      where: { id, botId },
      include: { contact: true },
    });
    if (!msg) throw new NotFoundException('Mensagem agendada não encontrada');
    return msg;
  }

  async cancel(botId: string, userId: string, id: string) {
    const msg = await this.findOne(botId, userId, id);
    if (msg.status !== 'PENDING') {
      throw new NotFoundException('Apenas mensagens pendentes podem ser canceladas');
    }
    return this.prisma.scheduledMessage.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  async remove(botId: string, userId: string, id: string) {
    await this.findOne(botId, userId, id);
    await this.prisma.scheduledMessage.delete({ where: { id } });
    return { message: 'Mensagem agendada removida' };
  }

  /** Cron: executa a cada minuto para enviar mensagens agendadas */
  @Cron(CronExpression.EVERY_MINUTE)
  async processPendingScheduledMessages() {
    const now = new Date();
    const pending = await this.prisma.scheduledMessage.findMany({
      where: {
        status: 'PENDING',
        scheduledAt: { lte: now },
      },
      include: {
        bot: {
          include: { whatsappChannel: true },
        },
      },
      take: 50,
    });

    for (const msg of pending) {
      try {
        const channel = msg.bot.whatsappChannel;
        if (!channel) {
          throw new Error('Canal WhatsApp não configurado para este bot');
        }
        const channelConfig = MessagingService.fromChannel(channel);
        await this.messaging.sendTextMessage(channelConfig, msg.phone, msg.message);

        await this.prisma.scheduledMessage.update({
          where: { id: msg.id },
          data: { status: 'SENT', sentAt: new Date() },
        });
        this.logger.log(`Mensagem agendada ${msg.id} enviada para ${msg.phone}`);
      } catch (err) {
        await this.prisma.scheduledMessage.update({
          where: { id: msg.id },
          data: { status: 'FAILED', errorMessage: err.message },
        });
        this.logger.error(`Falha ao enviar mensagem agendada ${msg.id}: ${err.message}`);
      }
    }
  }
}
