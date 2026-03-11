import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAiConfigDto, UpdateAiConfigDto } from './dto/ai-config.dto';

@Injectable()
export class AiConfigService {
  private readonly logger = new Logger(AiConfigService.name);

  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateAiConfigDto) {
    this.logger.log(`Criando config de I.A. "${dto.name}" (provider: ${dto.provider}) para usuário ${userId}`);
    try {
      if (dto.isDefault) {
        await this.prisma.aiConfig.updateMany({
          where: { userId, provider: dto.provider, isDefault: true },
          data: { isDefault: false },
        });
      }

      return await this.prisma.aiConfig.create({
        data: { ...dto, userId },
      });
    } catch (err) {
      this.logger.error(`Erro ao criar config de I.A. para usuário ${userId}: ${err.message}`, err.stack);
      throw err;
    }
  }

  async findAll(userId: string) {
    this.logger.log(`Listando configs de I.A. do usuário ${userId}`);
    try {
      return await this.prisma.aiConfig.findMany({
        where: { userId },
        orderBy: [{ provider: 'asc' }, { createdAt: 'desc' }],
        include: { _count: { select: { bots: true } } },
      });
    } catch (err) {
      this.logger.error(`Erro ao listar configs de I.A. do usuário ${userId}: ${err.message}`, err.stack);
      throw err;
    }
  }

  async findOne(userId: string, id: string) {
    this.logger.log(`Buscando config de I.A. ${id} do usuário ${userId}`);
    try {
      const config = await this.prisma.aiConfig.findUnique({
        where: { id },
        include: { _count: { select: { bots: true } } },
      });
      if (!config) throw new NotFoundException('Configuração de I.A. não encontrada');
      if (config.userId !== userId) throw new ForbiddenException('Acesso negado a esta configuração');
      return config;
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof ForbiddenException) throw err;
      this.logger.error(`Erro ao buscar config de I.A. ${id}: ${err.message}`, err.stack);
      throw err;
    }
  }

  async update(userId: string, id: string, dto: UpdateAiConfigDto) {
    this.logger.log(`Atualizando config de I.A. ${id} do usuário ${userId}`);
    try {
      const config = await this.findOne(userId, id);

      if (dto.isDefault) {
        await this.prisma.aiConfig.updateMany({
          where: { userId, provider: config.provider, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }

      return await this.prisma.aiConfig.update({
        where: { id },
        data: dto,
        include: { _count: { select: { bots: true } } },
      });
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof ForbiddenException) throw err;
      this.logger.error(`Erro ao atualizar config de I.A. ${id}: ${err.message}`, err.stack);
      throw err;
    }
  }

  async remove(userId: string, id: string) {
    this.logger.log(`Removendo config de I.A. ${id} do usuário ${userId}`);
    try {
      await this.findOne(userId, id);
      return await this.prisma.aiConfig.delete({ where: { id } });
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof ForbiddenException) throw err;
      this.logger.error(`Erro ao remover config de I.A. ${id}: ${err.message}`, err.stack);
      throw err;
    }
  }
}
