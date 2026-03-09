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
