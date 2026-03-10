import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { ConversationModule } from '../conversation/conversation.module';
import { KeywordModule } from '../keyword/keyword.module';
import { ServicesModule } from '../services/services.module';
import { MenuModule } from '../menu/menu.module';

@Module({
  imports: [ConversationModule, KeywordModule, ServicesModule, MenuModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
