import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingService } from '../services/messaging.service';
import { CreateBroadcastListDto, UpdateBroadcastListDto } from './dto/create-broadcast-list.dto';
import { CreateBroadcastDto } from './dto/create-broadcast.dto';

@Injectable()
export class BroadcastService {
  private readonly logger = new Logger(BroadcastService.name);

  constructor(
    private prisma: PrismaService,
    private messaging: MessagingService,
  ) {}

  private async ensureBotOwnership(botId: string, userId: string) {
    const bot = await this.prisma.bot.findFirst({ where: { id: botId, userId } });
    if (!bot) throw new NotFoundException('Bot não encontrado');
    return bot;
  }

  // ─── Listas de transmissão ────────────────────────────────────────────────

  async createList(botId: string, userId: string, dto: CreateBroadcastListDto) {
    await this.ensureBotOwnership(botId, userId);
    return this.prisma.broadcastList.create({
      data: { botId, name: dto.name, phones: dto.phones ?? [] },
    });
  }

  async findAllLists(botId: string, userId: string) {
    await this.ensureBotOwnership(botId, userId);
    return this.prisma.broadcastList.findMany({
      where: { botId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { broadcasts: true } } },
    });
  }

  async findOneList(botId: string, userId: string, id: string) {
    await this.ensureBotOwnership(botId, userId);
    const list = await this.prisma.broadcastList.findFirst({ where: { id, botId } });
    if (!list) throw new NotFoundException('Lista de transmissão não encontrada');
    return list;
  }

  async updateList(botId: string, userId: string, id: string, dto: UpdateBroadcastListDto) {
    await this.findOneList(botId, userId, id);
    return this.prisma.broadcastList.update({ where: { id }, data: dto });
  }

  async removeList(botId: string, userId: string, id: string) {
    await this.findOneList(botId, userId, id);
    await this.prisma.broadcastList.delete({ where: { id } });
    return { message: 'Lista removida com sucesso' };
  }

  // ─── Broadcasts ───────────────────────────────────────────────────────────

  async createBroadcast(botId: string, userId: string, dto: CreateBroadcastDto) {
    await this.ensureBotOwnership(botId, userId);

    let phones = dto.phones ?? [];
    if (dto.listId) {
      const list = await this.prisma.broadcastList.findFirst({ where: { id: dto.listId, botId } });
      if (!list) throw new NotFoundException('Lista não encontrada');
      phones = [...new Set([...phones, ...list.phones])];
    }
    if (phones.length === 0) {
      throw new BadRequestException('Nenhum número de destino informado');
    }

    return this.prisma.broadcast.create({
      data: {
        botId,
        listId: dto.listId ?? null,
        name: dto.name,
        message: dto.message,
        phones,
        totalRecipients: phones.length,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      },
    });
  }

  async findAllBroadcasts(botId: string, userId: string) {
    await this.ensureBotOwnership(botId, userId);
    return this.prisma.broadcast.findMany({
      where: { botId },
      orderBy: { createdAt: 'desc' },
      include: { list: { select: { id: true, name: true } } },
    });
  }

  async findOneBroadcast(botId: string, userId: string, id: string) {
    await this.ensureBotOwnership(botId, userId);
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id, botId },
      include: { list: true },
    });
    if (!broadcast) throw new NotFoundException('Broadcast não encontrado');
    return broadcast;
  }

  async cancelBroadcast(botId: string, userId: string, id: string) {
    const broadcast = await this.findOneBroadcast(botId, userId, id);
    if (!['DRAFT', 'SENDING'].includes(broadcast.status)) {
      throw new BadRequestException('Apenas broadcasts em rascunho ou enviando podem ser cancelados');
    }
    return this.prisma.broadcast.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  async removeBroadcast(botId: string, userId: string, id: string) {
    await this.findOneBroadcast(botId, userId, id);
    await this.prisma.broadcast.delete({ where: { id } });
    return { message: 'Broadcast removido' };
  }

  /** Envio imediato de um broadcast em rascunho */
  async sendBroadcastNow(botId: string, userId: string, id: string) {
    const broadcast = await this.findOneBroadcast(botId, userId, id);
    if (broadcast.status !== 'DRAFT') {
      throw new BadRequestException('Apenas broadcasts em rascunho podem ser enviados');
    }
    // Marca como SENDING e agenda para próxima execução do cron
    return this.prisma.broadcast.update({
      where: { id },
      data: { status: 'SENDING', startedAt: new Date(), scheduledAt: new Date() },
    });
  }

  /** Cron: processa broadcasts agendados ou em envio */
  @Cron(CronExpression.EVERY_MINUTE)
  async processPendingBroadcasts() {
    const now = new Date();
    const broadcasts = await this.prisma.broadcast.findMany({
      where: {
        status: 'SENDING',
        OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
      },
      include: {
        bot: { include: { whatsappChannel: true } },
      },
      take: 5,
    });

    // Também pega os que estão agendados como DRAFT mas já passaram do horário
    const scheduledDrafts = await this.prisma.broadcast.findMany({
      where: {
        status: 'DRAFT',
        scheduledAt: { lte: now },
      },
      include: {
        bot: { include: { whatsappChannel: true } },
      },
      take: 5,
    });

    const toProcess = [...broadcasts, ...scheduledDrafts];

    for (const broadcast of toProcess) {
      await this.prisma.broadcast.update({
        where: { id: broadcast.id },
        data: { status: 'SENDING', startedAt: broadcast.startedAt ?? new Date() },
      });

      const channel = broadcast.bot.whatsappChannel;
      if (!channel) {
        await this.prisma.broadcast.update({
          where: { id: broadcast.id },
          data: { status: 'FAILED' },
        });
        this.logger.error(`Broadcast ${broadcast.id}: canal não configurado`);
        continue;
      }

      const channelConfig = MessagingService.fromChannel(channel);
      let successCount = 0;
      let failCount = 0;

      for (const phone of broadcast.phones) {
        try {
          await this.messaging.sendTextMessage(channelConfig, phone, broadcast.message);
          successCount++;
          // Delay entre envios para evitar bloqueio (300ms)
          await new Promise((r) => setTimeout(r, 300));
        } catch (err) {
          failCount++;
          this.logger.error(`Broadcast ${broadcast.id} - erro ao enviar para ${phone}: ${err.message}`);
        }
      }

      await this.prisma.broadcast.update({
        where: { id: broadcast.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          successCount,
          failCount,
        },
      });
      this.logger.log(`Broadcast ${broadcast.id} concluído: ${successCount} enviados, ${failCount} falhas`);
    }
  }
}
