import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
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
import { ChatManagementModule } from './chat-management/chat-management.module';
import { ContactModule } from './contact/contact.module';
import { ScheduledMessageModule } from './scheduled-message/scheduled-message.module';
import { BroadcastModule } from './broadcast/broadcast.module';
import { LeadModule } from './lead/lead.module';
import { IterationModule } from './iteration/iteration.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { ConfiguracaoModule } from './configuracao/configuracao.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
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
    ChatManagementModule,
    ContactModule,
    ScheduledMessageModule,
    BroadcastModule,
    LeadModule,
    IterationModule,
    KnowledgeModule,
    SubscriptionModule,
    ConfiguracaoModule,
    AdminModule,
  ],
})
export class AppModule {}
