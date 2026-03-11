import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BotService } from '../bot/bot.service';
import { Dialog360Service } from '../services/dialog360.service';
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
    private config: ConfigService,
  ) {}

  async create(userId: string, botId: string, dto: CreateWhatsappChannelDto) {
    this.logger.log(`Criando canal WhatsApp para bot ${botId} (telefone: ${dto.phoneNumber})`);
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
      await this.dialog360.setWebhook(
        dto.dialog360ApiKey,
        `${baseUrl}/webhook/${botId}`,
      );

      const channel = await this.prisma.whatsappChannel.create({
        data: {
          botId,
          phoneNumber: dto.phoneNumber,
          dialog360ApiKey: dto.dialog360ApiKey,
          webhookSecret,
        },
      });

      this.logger.log(`Canal WhatsApp criado com sucesso para bot ${botId}`);
      return channel;
    } catch (err) {
      if (err instanceof ConflictException) throw err;
      this.logger.error(`Erro ao criar canal WhatsApp para bot ${botId}: ${err.message}`, err.stack);
      throw err;
    }
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
      const result = await this.prisma.whatsappChannel.delete({ where: { botId } });
      this.logger.log(`Canal WhatsApp removido com sucesso do bot ${botId}`);
      return result;
    } catch (err) {
      this.logger.error(`Erro ao remover canal WhatsApp do bot ${botId}: ${err.message}`, err.stack);
      throw err;
    }
  }
}
