import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EvolutionService } from '../services/evolution.service';
import { ConfigService } from '@nestjs/config';
import { SubscriptionPlan } from '@prisma/client';
import { getPlanConfig } from '../common/plans/plan-config';

@Injectable()
export class ConfiguracaoService {
  private readonly logger = new Logger(ConfiguracaoService.name);

  constructor(
    private prisma: PrismaService,
    private evolution: EvolutionService,
    private config: ConfigService,
  ) {}

  private getEvolutionConfig() {
    const baseUrl = this.config.get<string>('EVOLUTION_API_URL');
    const apiKey = this.config.get<string>('EVOLUTION_API_KEY');
    if (!baseUrl || !apiKey) {
      throw new BadRequestException(
        'Evolution API não configurada no servidor. Defina EVOLUTION_API_URL e EVOLUTION_API_KEY.',
      );
    }
    return { baseUrl, apiKey };
  }

  private getInstanceName(userId: string): string {
    return `user_${userId.replace(/-/g, '').substring(0, 16)}`;
  }

  /** Verifica se o plano do usuário permite uso do Evolution API */
  private checkPlanAccess(plan: SubscriptionPlan, planActive: boolean) {
    if (!planActive) {
      throw new ForbiddenException('Seu plano está inativo. Renove sua assinatura para continuar.');
    }
    // Tester tem acesso limitado - só pode criar 1 instância
    // PRO e ENTERPRISE têm acesso completo
    const planConfig = getPlanConfig(plan);
    return planConfig;
  }

  /** Busca a instância Evolution do usuário */
  async getInstance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, plan: true, planActive: true, planExpiresAt: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const instance = await this.prisma.evolutionInstance.findUnique({
      where: { userId },
    });

    const planConfig = getPlanConfig(user.plan);

    return {
      instance,
      plan: user.plan,
      planActive: user.planActive,
      planConfig: {
        name: planConfig.name,
        maxBots: planConfig.maxBots,
        maxDailyMessages: planConfig.maxDailyMessages,
        price: planConfig.price,
      },
    };
  }

  /** Cria uma instância Evolution para o usuário */
  async createInstance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, plan: true, planActive: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    this.checkPlanAccess(user.plan, user.planActive);

    const existing = await this.prisma.evolutionInstance.findUnique({
      where: { userId },
    });
    if (existing) {
      throw new BadRequestException('Você já possui uma instância Evolution. Delete a existente para criar uma nova.');
    }

    const { baseUrl, apiKey } = this.getEvolutionConfig();
    const instanceName = this.getInstanceName(userId);
    const webhookBaseUrl = this.config.get<string>('WEBHOOK_BASE_URL');
    const webhookUrl = `${webhookBaseUrl}/webhook/evolution-global/${userId}`;

    this.logger.log(`Criando instância Evolution '${instanceName}' para usuário ${userId}`);

    try {
      const result = await this.evolution.createInstance(baseUrl, apiKey, instanceName, webhookUrl);

      const instance = await this.prisma.evolutionInstance.create({
        data: {
          userId,
          instanceName,
          status: 'QRCODE',
          webhookUrl,
        },
      });

      this.logger.log(`Instância '${instanceName}' criada com sucesso para usuário ${userId}`);

      return { instance, evolutionData: result };
    } catch (error) {
      this.logger.error(`Erro ao criar instância Evolution para usuário ${userId}: ${error.message}`);
      throw new BadRequestException(`Falha ao criar instância na Evolution API: ${error.message}`);
    }
  }

  /** Busca o QR Code da instância do usuário */
  async getQrCode(userId: string) {
    const instance = await this.prisma.evolutionInstance.findUnique({
      where: { userId },
    });
    if (!instance) {
      throw new NotFoundException('Nenhuma instância encontrada. Crie uma instância primeiro.');
    }

    const { baseUrl, apiKey } = this.getEvolutionConfig();

    try {
      const result = await this.evolution.getQrCode(baseUrl, apiKey, instance.instanceName);

      // Atualiza status para QRCODE se ainda não conectado
      if (instance.status !== 'CONNECTED') {
        await this.prisma.evolutionInstance.update({
          where: { userId },
          data: { status: 'QRCODE' },
        });
      }

      return result;
    } catch (error) {
      this.logger.error(`Erro ao obter QR Code para usuário ${userId}: ${error.message}`);
      throw new BadRequestException(`Falha ao obter QR Code: ${error.message}`);
    }
  }

  /** Verifica o estado da conexão */
  async getConnectionStatus(userId: string) {
    const instance = await this.prisma.evolutionInstance.findUnique({
      where: { userId },
    });
    if (!instance) {
      return { connected: false, status: 'NOT_CREATED' };
    }

    const { baseUrl, apiKey } = this.getEvolutionConfig();

    try {
      const result = await this.evolution.getConnectionState(baseUrl, apiKey, instance.instanceName);

      // Atualiza status no banco conforme resposta da Evolution
      const evolutionState = result?.instance?.state || result?.state;
      let newStatus = instance.status;

      if (evolutionState === 'open') newStatus = 'CONNECTED';
      else if (evolutionState === 'close') newStatus = 'DISCONNECTED';
      else if (evolutionState === 'connecting') newStatus = 'CONNECTING';

      if (newStatus !== instance.status) {
        await this.prisma.evolutionInstance.update({
          where: { userId },
          data: { status: newStatus },
        });
      }

      return { ...result, localStatus: newStatus, instanceName: instance.instanceName };
    } catch (error) {
      this.logger.error(`Erro ao verificar status da instância para usuário ${userId}: ${error.message}`);
      return { connected: false, status: 'ERROR', error: error.message };
    }
  }

  /** Desconecta e remove a instância do usuário */
  async deleteInstance(userId: string) {
    const instance = await this.prisma.evolutionInstance.findUnique({
      where: { userId },
    });
    if (!instance) {
      throw new NotFoundException('Nenhuma instância encontrada.');
    }

    const { baseUrl, apiKey } = this.getEvolutionConfig();

    // Tenta desconectar da Evolution (ignora erros)
    try {
      await this.evolution.logoutInstance(baseUrl, apiKey, instance.instanceName);
    } catch (e) {
      this.logger.warn(`Falha ao desconectar instância Evolution: ${e.message}`);
    }

    // Tenta deletar da Evolution (ignora erros)
    try {
      await this.evolution.deleteInstance(baseUrl, apiKey, instance.instanceName);
    } catch (e) {
      this.logger.warn(`Falha ao deletar instância Evolution: ${e.message}`);
    }

    await this.prisma.evolutionInstance.delete({ where: { userId } });

    this.logger.log(`Instância Evolution removida para usuário ${userId}`);
    return { message: 'Instância removida com sucesso.' };
  }

  /** Atualiza status da instância (chamado por webhook) */
  async updateInstanceStatus(userId: string, status: string, phoneNumber?: string) {
    await this.prisma.evolutionInstance.updateMany({
      where: { userId },
      data: { status, ...(phoneNumber ? { phoneNumber } : {}) },
    });
  }
}
