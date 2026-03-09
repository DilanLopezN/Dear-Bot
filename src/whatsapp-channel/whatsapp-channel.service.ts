import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BotService } from '../bot/bot.service';
import { Dialog360Service } from '../services/dialog360.service';
import { CreateWhatsappChannelDto, UpdateWhatsappChannelDto } from './dto/whatsapp-channel.dto';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';

@Injectable()
export class WhatsappChannelService {
  constructor(
    private prisma: PrismaService,
    private botService: BotService,
    private dialog360: Dialog360Service,
    private config: ConfigService,
  ) {}

  async create(userId: string, botId: string, dto: CreateWhatsappChannelDto) {
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

    // Registra webhook no Dialog360
    const baseUrl = this.config.get('WEBHOOK_BASE_URL');
    await this.dialog360.setWebhook(
      dto.dialog360ApiKey,
      `${baseUrl}/webhook/${botId}`,
    );

    return this.prisma.whatsappChannel.create({
      data: {
        botId,
        phoneNumber: dto.phoneNumber,
        dialog360ApiKey: dto.dialog360ApiKey,
        webhookSecret,
      },
    });
  }

  async update(userId: string, botId: string, dto: UpdateWhatsappChannelDto) {
    await this.botService.findOne(userId, botId);
    return this.prisma.whatsappChannel.update({
      where: { botId },
      data: dto,
    });
  }

  async remove(userId: string, botId: string) {
    await this.botService.findOne(userId, botId);
    return this.prisma.whatsappChannel.delete({ where: { botId } });
  }
}
