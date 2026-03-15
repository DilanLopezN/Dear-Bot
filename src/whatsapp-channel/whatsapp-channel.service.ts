import { Injectable, ConflictException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BotService } from '../bot/bot.service';
import { Dialog360Service } from '../services/dialog360.service';
import { EvolutionService } from '../services/evolution.service';
import { BaileysService } from '../services/baileys.service';
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
    private baileys: BaileysService,
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

      if (provider === 'BAILEYS') {
        const sessionId = dto.baileysSessionId || `baileys-${botId}`;

        // Cria sessão Baileys
        await this.baileys.createSession(sessionId);

        const channel = await this.prisma.whatsappChannel.create({
          data: {
            botId,
            phoneNumber: dto.phoneNumber,
            provider: 'BAILEYS',
            baileysSessionId: sessionId,
            webhookSecret,
          },
        });

        this.logger.log(`Canal WhatsApp (Baileys) criado com sucesso para bot ${botId}`);
        return channel;
      }

      if (provider === 'EVOLUTION') {
        if (!dto.evolutionApiUrl || !dto.evolutionApiKey || !dto.evolutionInstance) {
          throw new BadRequestException('evolutionApiUrl, evolutionApiKey e evolutionInstance são obrigatórios para Evolution API');
        }

        // Configura webhook na Evolution
        await this.evolution.setWebhook(
          dto.evolutionApiUrl,
          dto.evolutionApiKey,
          dto.evolutionInstance,
          `${baseUrl}/webhook/evolution/${botId}`,
        );

        const channel = await this.prisma.whatsappChannel.create({
          data: {
            botId,
            phoneNumber: dto.phoneNumber,
            provider: 'EVOLUTION',
            evolutionApiUrl: dto.evolutionApiUrl,
            evolutionApiKey: dto.evolutionApiKey,
            evolutionInstance: dto.evolutionInstance,
            webhookSecret,
          },
        });

        this.logger.log(`Canal WhatsApp (Evolution) criado com sucesso para bot ${botId}`);
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

    return this.evolution.getQrCode(
      channel.evolutionApiUrl!,
      channel.evolutionApiKey!,
      channel.evolutionInstance!,
    );
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

    return this.evolution.getConnectionState(
      channel.evolutionApiUrl!,
      channel.evolutionApiKey!,
      channel.evolutionInstance!,
    );
  }

  /** Busca QR Code para Baileys */
  async getBaileysQrCode(userId: string, botId: string) {
    await this.botService.findOne(userId, botId);

    const channel = await this.prisma.whatsappChannel.findUnique({
      where: { botId },
    });

    if (!channel || channel.provider !== 'BAILEYS') {
      throw new BadRequestException('Canal Baileys não encontrado');
    }

    return this.baileys.getQrCode(channel.baileysSessionId!);
  }

  /** Verifica estado da conexão Baileys */
  async getBaileysConnectionState(userId: string, botId: string) {
    await this.botService.findOne(userId, botId);

    const channel = await this.prisma.whatsappChannel.findUnique({
      where: { botId },
    });

    if (!channel || channel.provider !== 'BAILEYS') {
      throw new BadRequestException('Canal Baileys não encontrado');
    }

    return this.baileys.getConnectionState(channel.baileysSessionId!);
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

      // Tenta remover sessão Baileys se aplicável
      if (channel?.provider === 'BAILEYS' && channel.baileysSessionId) {
        try {
          await this.baileys.logoutSession(channel.baileysSessionId);
        } catch (e) {
          this.logger.warn(`Falha ao desconectar sessão Baileys: ${e.message}`);
        }
      }

      // Tenta remover instância na Evolution se aplicável
      if (channel?.provider === 'EVOLUTION' && channel.evolutionApiUrl && channel.evolutionApiKey && channel.evolutionInstance) {
        try {
          await this.evolution.logoutInstance(
            channel.evolutionApiUrl,
            channel.evolutionApiKey,
            channel.evolutionInstance,
          );
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
