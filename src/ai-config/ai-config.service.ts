import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAiConfigDto, UpdateAiConfigDto } from './dto/ai-config.dto';

@Injectable()
export class AiConfigService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateAiConfigDto) {
    // If setting as default, unset other defaults for same provider
    if (dto.isDefault) {
      await this.prisma.aiConfig.updateMany({
        where: { userId, provider: dto.provider, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.aiConfig.create({
      data: { ...dto, userId },
    });
  }

  async findAll(userId: string) {
    return this.prisma.aiConfig.findMany({
      where: { userId },
      orderBy: [{ provider: 'asc' }, { createdAt: 'desc' }],
      include: { _count: { select: { bots: true } } },
    });
  }

  async findOne(userId: string, id: string) {
    const config = await this.prisma.aiConfig.findUnique({
      where: { id },
      include: { _count: { select: { bots: true } } },
    });
    if (!config) throw new NotFoundException('Configuração de I.A. não encontrada');
    if (config.userId !== userId) throw new ForbiddenException();
    return config;
  }

  async update(userId: string, id: string, dto: UpdateAiConfigDto) {
    const config = await this.findOne(userId, id);

    // If setting as default, unset other defaults for same provider
    if (dto.isDefault) {
      await this.prisma.aiConfig.updateMany({
        where: { userId, provider: config.provider, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return this.prisma.aiConfig.update({
      where: { id },
      data: dto,
      include: { _count: { select: { bots: true } } },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    return this.prisma.aiConfig.delete({ where: { id } });
  }
}
