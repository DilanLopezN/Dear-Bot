import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { ConversationModule } from '../conversation/conversation.module';
import { KeywordModule } from '../keyword/keyword.module';
import { ServicesModule } from '../services/services.module';
import { MenuModule } from '../menu/menu.module';
import { ContactModule } from '../contact/contact.module';
import { LeadModule } from '../lead/lead.module';
import { IterationModule } from '../iteration/iteration.module';
import { ContextCacheService } from './context-cache.service';

@Module({
  imports: [ConversationModule, KeywordModule, ServicesModule, MenuModule, ContactModule, LeadModule, IterationModule],
  controllers: [WebhookController],
  providers: [WebhookService, ContextCacheService],
})
export class WebhookModule {}
