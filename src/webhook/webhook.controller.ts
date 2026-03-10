import { Controller, Post, Param, Body, Logger, HttpCode } from '@nestjs/common';
import { WebhookService } from './webhook.service';

/**
 * Payload do Dialog360 webhook (Cloud API format)
 * Documentação: https://docs.360dialog.com/docs/waba-messaging/receiving-messages
 */
interface Dialog360WebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: { display_phone_number: string; phone_number_id: string };
        contacts?: Array<{ profile: { name: string }; wa_id: string }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
          interactive?: {
            type: string;
            list_reply?: { id: string; title: string; description?: string };
            button_reply?: { id: string; title: string };
          };
        }>;
        statuses?: Array<{
          id: string;
          status: string;
          timestamp: string;
          recipient_id: string;
        }>;
      };
      field: string;
    }>;
  }>;
}

@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private webhookService: WebhookService) {}

  @Post(':botId')
  @HttpCode(200)
  async handleWebhook(
    @Param('botId') botId: string,
    @Body() payload: Dialog360WebhookPayload,
  ) {
    this.logger.log(`Webhook recebido para bot ${botId}`);

    // Processa cada entry do payload
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;

        // Processa mensagens
        if (value.messages && value.messages.length > 0) {
          for (const message of value.messages) {
            const contactName = value.contacts?.[0]?.profile?.name;

            // Mensagens de texto
            if (message.type === 'text' && message.text?.body) {
              await this.webhookService.processIncomingMessage(
                botId,
                message.from,
                message.text.body,
                message.id,
                contactName,
              );
            }

            // Respostas interativas (list_reply ou button_reply)
            if (message.type === 'interactive' && message.interactive) {
              const interactive = message.interactive;
              const reply = interactive.list_reply || interactive.button_reply;
              if (reply) {
                await this.webhookService.processInteractiveResponse(
                  botId,
                  message.from,
                  interactive.type,
                  reply.id,
                  reply.title,
                  message.id,
                  contactName,
                );
              }
            }
          }
        }

        // Processa status updates (delivered, read, etc.)
        if (value.statuses) {
          for (const status of value.statuses) {
            await this.webhookService.processStatusUpdate(
              botId,
              status.id,
              status.status,
            );
          }
        }
      }
    }

    return { status: 'ok' };
  }
}
