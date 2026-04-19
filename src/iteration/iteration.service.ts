import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BotService } from '../bot/bot.service';
import { CreateIterationDto, UpdateIterationDto } from './dto/iteration.dto';

@Injectable()
export class IterationService {
  private readonly logger = new Logger(IterationService.name);

  constructor(
    private prisma: PrismaService,
    private botService: BotService,
  ) {}

  async create(userId: string, botId: string, dto: CreateIterationDto) {
    this.logger.log(`Criando iteração "${dto.name}" no bot ${botId}`);
    await this.botService.findOne(userId, botId);
    return this.prisma.botIteration.create({
      data: {
        botId,
        name: dto.name,
        type: dto.type,
        mode: dto.mode ?? 'FLUXO',
        content: dto.content as any,
        order: dto.order ?? 0,
      },
    });
  }

  async findAll(userId: string, botId: string) {
    await this.botService.findOne(userId, botId);
    return this.prisma.botIteration.findMany({
      where: { botId },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(userId: string, botId: string, iterationId: string) {
    await this.botService.findOne(userId, botId);
    const iteration = await this.prisma.botIteration.findFirst({
      where: { id: iterationId, botId },
    });
    if (!iteration) throw new NotFoundException('Iteração não encontrada');
    return iteration;
  }

  async update(userId: string, botId: string, iterationId: string, dto: UpdateIterationDto) {
    this.logger.log(`Atualizando iteração ${iterationId} no bot ${botId}`);
    await this.botService.findOne(userId, botId);
    const iteration = await this.prisma.botIteration.findFirst({
      where: { id: iterationId, botId },
    });
    if (!iteration) throw new NotFoundException('Iteração não encontrada');

    return this.prisma.botIteration.update({
      where: { id: iterationId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.mode !== undefined && { mode: dto.mode }),
        ...(dto.content !== undefined && { content: dto.content as any }),
        ...(dto.order !== undefined && { order: dto.order }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async remove(userId: string, botId: string, iterationId: string) {
    this.logger.log(`Removendo iteração ${iterationId} do bot ${botId}`);
    await this.botService.findOne(userId, botId);
    const iteration = await this.prisma.botIteration.findFirst({
      where: { id: iterationId, botId },
    });
    if (!iteration) throw new NotFoundException('Iteração não encontrada');
    return this.prisma.botIteration.delete({ where: { id: iterationId } });
  }

  async findActiveByBot(botId: string) {
    return this.prisma.botIteration.findMany({
      where: { botId, isActive: true },
      orderBy: { order: 'asc' },
    });
  }
}
