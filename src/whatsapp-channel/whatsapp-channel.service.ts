import { Injectable, ConflictException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BotService } from '../bot/bot.service';
import { Dialog360Service } from '../services/dialog360.service';
import { EvolutionService } from '../services/evolution.service';
import { CreateWhatsappChannelDto, UpdateWhatsappChannelDto } from './dto/whatsapp-channel.dto';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';

@Injectable()
export class WhatsappChannelService {
  private readonly logger = new Logger(WhatsappChannelService.name);

  constructor(
    private prisma: PrismaService,
    private botService: BotService,
    private dialog360: Dialog360Service,
    private evolution: EvolutionService,
    private config: ConfigService,
  ) {}

  async create(userId: string, botId: string, dto: CreateWhatsappChannelDto) {
    const provider = dto.provider || 'DIALOG360';
    this.logger.log(`Criando canal WhatsApp (${provider}) para bot ${botId} (telefone: ${dto.phoneNumber})`);

    try {
      await this.botService.findOne(userId, botId);

      const exists = await this.prisma.whatsappChannel.findUnique({
        where: { botId },
      });
      if (exists) throw new ConflictException('Bot já tem um canal WhatsApp');

      const phoneExists = await this.prisma.whatsappChannel.findUnique({
        where: { phoneNumber: dto.phoneNumber },
      });
      if (phoneExists) throw new ConflictException('Número já em uso');

      const webhookSecret = uuid();
      const baseUrl = this.config.get('WEBHOOK_BASE_URL');

      if (provider === 'EVOLUTION') {
        // Usa a instância global do usuário (Configuração)
        const globalInstance = await this.prisma.evolutionInstance.findFirst({
          where: { userId },
        });

        if (!globalInstance) {
          throw new BadRequestException(
            'Nenhuma instância Evolution configurada. Vá em Configuração para criar sua instância WhatsApp primeiro.',
          );
        }

        const evolutionApiUrl = this.config.get<string>('EVOLUTION_API_URL')?.trim()?.replace(/\/+$/, '');
        const evolutionApiKey = this.config.get<string>('EVOLUTION_API_KEY')?.trim();

        if (!evolutionApiUrl || !evolutionApiKey) {
          throw new BadRequestException('Evolution API não configurada no servidor.');
        }

        // Configura webhook na Evolution para este bot
        await this.evolution.setWebhook(
          evolutionApiUrl,
          evolutionApiKey,
          globalInstance.instanceName,
          `${baseUrl}/webhook/evolution/${botId}`,
        );

        const channel = await this.prisma.whatsappChannel.create({
          data: {
            botId,
            phoneNumber: dto.phoneNumber,
            provider: 'EVOLUTION',
            evolutionApiUrl,
            evolutionApiKey,
            evolutionInstance: globalInstance.instanceName,
            webhookSecret,
          },
        });

        this.logger.log(`Canal WhatsApp (Evolution) criado com sucesso para bot ${botId} usando instância global '${globalInstance.instanceName}'`);
        return channel;
      }

      // Dialog360 (padrão)
      if (!dto.dialog360ApiKey) {
        throw new BadRequestException('dialog360ApiKey é obrigatório para Dialog360');
      }

      await this.dialog360.setWebhook(
        dto.dialog360ApiKey,
        `${baseUrl}/webhook/${botId}`,
      );

      const channel = await this.prisma.whatsappChannel.create({
        data: {
          botId,
          phoneNumber: dto.phoneNumber,
          provider: 'DIALOG360',
          dialog360ApiKey: dto.dialog360ApiKey,
          webhookSecret,
        },
      });

      this.logger.log(`Canal WhatsApp (Dialog360) criado com sucesso para bot ${botId}`);
      return channel;
    } catch (err) {
      if (err instanceof ConflictException || err instanceof BadRequestException) throw err;
      this.logger.error(`Erro ao criar canal WhatsApp para bot ${botId}: ${err.message}`, err.stack);
      throw err;
    }
  }

  /** Busca QR Code para Evolution API */
  async getEvolutionQrCode(userId: string, botId: string) {
    await this.botService.findOne(userId, botId);

    const channel = await this.prisma.whatsappChannel.findUnique({
      where: { botId },
    });

    if (!channel || channel.provider !== 'EVOLUTION') {
      throw new BadRequestException('Canal Evolution não encontrado');
    }

    const evolutionApiUrl = channel.evolutionApiUrl || this.config.get<string>('EVOLUTION_API_URL')?.trim()?.replace(/\/+$/, '');
    const evolutionApiKey = channel.evolutionApiKey || this.config.get<string>('EVOLUTION_API_KEY')?.trim();

    const result = await this.evolution.getQrCode(
      evolutionApiUrl!,
      evolutionApiKey!,
      channel.evolutionInstance!,
    );

    // Normaliza a resposta do Evolution API (v2.x pode retornar em formatos diferentes)
    const qrcode = result?.qrcode || result;
    const base64 = qrcode?.base64 || result?.base64 || null;
    const code = qrcode?.code || result?.code || null;
    const pairingCode = qrcode?.pairingCode || result?.pairingCode || null;

    return { base64, code, pairingCode };
  }

  /** Verifica estado da conexão Evolution API */
  async getEvolutionConnectionState(userId: string, botId: string) {
    await this.botService.findOne(userId, botId);

    const channel = await this.prisma.whatsappChannel.findUnique({
      where: { botId },
    });

    if (!channel || channel.provider !== 'EVOLUTION') {
      throw new BadRequestException('Canal Evolution não encontrado');
    }

    const evolutionApiUrl = channel.evolutionApiUrl || this.config.get<string>('EVOLUTION_API_URL')?.trim()?.replace(/\/+$/, '');
    const evolutionApiKey = channel.evolutionApiKey || this.config.get<string>('EVOLUTION_API_KEY')?.trim();

    return this.evolution.getConnectionState(
      evolutionApiUrl!,
      evolutionApiKey!,
      channel.evolutionInstance!,
    );
  }

  async update(userId: string, botId: string, dto: UpdateWhatsappChannelDto) {
    this.logger.log(`Atualizando canal WhatsApp do bot ${botId}`);
    try {
      await this.botService.findOne(userId, botId);
      const channel = await this.prisma.whatsappChannel.update({
        where: { botId },
        data: dto,
      });
      this.logger.log(`Canal WhatsApp atualizado com sucesso para bot ${botId}`);
      return channel;
    } catch (err) {
      this.logger.error(`Erro ao atualizar canal WhatsApp do bot ${botId}: ${err.message}`, err.stack);
      throw err;
    }
  }

  async remove(userId: string, botId: string) {
    this.logger.log(`Removendo canal WhatsApp do bot ${botId}`);
    try {
      await this.botService.findOne(userId, botId);

      const channel = await this.prisma.whatsappChannel.findUnique({
        where: { botId },
      });

      // Tenta desconectar da Evolution se aplicável (não deleta a instância global)
      if (channel?.provider === 'EVOLUTION' && channel.evolutionInstance) {
        try {
          const evolutionApiUrl = channel.evolutionApiUrl || this.config.get<string>('EVOLUTION_API_URL')?.trim()?.replace(/\/+$/, '');
          const evolutionApiKey = channel.evolutionApiKey || this.config.get<string>('EVOLUTION_API_KEY')?.trim();
          if (evolutionApiUrl && evolutionApiKey) {
            await this.evolution.logoutInstance(
              evolutionApiUrl,
              evolutionApiKey,
              channel.evolutionInstance,
            );
          }
        } catch (e) {
          this.logger.warn(`Falha ao desconectar instância Evolution: ${e.message}`);
        }
      }

      const result = await this.prisma.whatsappChannel.delete({ where: { botId } });
      this.logger.log(`Canal WhatsApp removido com sucesso do bot ${botId}`);
      return result;
    } catch (err) {
      this.logger.error(`Erro ao remover canal WhatsApp do bot ${botId}: ${err.message}`, err.stack);
      throw err;
    }
  }
}
