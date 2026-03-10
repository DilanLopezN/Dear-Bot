import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { BotModule } from './bot/bot.module';
import { KeywordModule } from './keyword/keyword.module';
import { WebhookModule } from './webhook/webhook.module';
import { ConversationModule } from './conversation/conversation.module';
import { WhatsappChannelModule } from './whatsapp-channel/whatsapp-channel.module';
import { ServicesModule } from './services/services.module';
import { MenuModule } from './menu/menu.module';
import { AiConfigModule } from './ai-config/ai-config.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    BotModule,
    KeywordModule,
    WebhookModule,
    ConversationModule,
    WhatsappChannelModule,
    ServicesModule,
    MenuModule,
    AiConfigModule,
  ],
})
export class AppModule {}
