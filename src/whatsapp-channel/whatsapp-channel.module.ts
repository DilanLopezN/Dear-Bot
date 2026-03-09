import { Module } from '@nestjs/common';
import { WhatsappChannelService } from './whatsapp-channel.service';
import { WhatsappChannelController } from './whatsapp-channel.controller';
import { BotModule } from '../bot/bot.module';
import { ServicesModule } from '../services/services.module';

@Module({
  imports: [BotModule, ServicesModule],
  controllers: [WhatsappChannelController],
  providers: [WhatsappChannelService],
})
export class WhatsappChannelModule {}
