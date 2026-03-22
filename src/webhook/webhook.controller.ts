import { Controller, Post, Delete, Param, Body, Logger, HttpCode } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Payload do Dialog360 webhook (Cloud API format)
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

/**
 * Payload da Evolution API webhook
 */
interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: any;
}

@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private webhookService: WebhookService,
    private prisma: PrismaService,
  ) {}

  /** Dialog360 webhook endpoint */
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

  /** Evolution API global webhook — handles CONNECTION_UPDATE for user instances */
  @Post('evolution-global/:userId')
  @HttpCode(200)
  async handleEvolutionGlobalWebhook(
    @Param('userId') userId: string,
    @Body() payload: EvolutionWebhookPayload,
  ) {
    this.logger.log(`Evolution global webhook para usuário ${userId} — evento: ${payload.event}`);

    if (payload.event === 'connection.update' || payload.event === 'CONNECTION_UPDATE') {
      const state = payload.data?.state || payload.data?.instance?.state;
      this.logger.log(`CONNECTION_UPDATE para usuário ${userId}: state=${state}`);

      let newStatus = 'CONNECTING';
      if (state === 'open') newStatus = 'CONNECTED';
      else if (state === 'close') newStatus = 'DISCONNECTED';

      try {
        await this.prisma.evolutionInstance.updateMany({
          where: { userId },
          data: { status: newStatus },
        });
        this.logger.log(`Status da instância do usuário ${userId} atualizado para ${newStatus}`);
      } catch (err) {
        this.logger.error(`Erro ao atualizar status da instância: ${err.message}`);
      }
    }

    // Forward MESSAGES_UPSERT to bot-specific handler if needed
    if (payload.event === 'messages.upsert' || payload.event === 'MESSAGES_UPSERT') {
      this.logger.log(`Mensagem recebida via webhook global do usuário ${userId}`);
    }

    return { status: 'ok' };
  }

  /** Evolution API webhook endpoint */
  @Post('evolution/:botId')
  @HttpCode(200)
  async handleEvolutionWebhook(
    @Param('botId') botId: string,
    @Body() payload: EvolutionWebhookPayload,
  ) {
    this.logger.log(`Evolution webhook recebido para bot ${botId} — evento: ${payload.event}`);

    if (payload.event === 'messages.upsert' || payload.event === 'MESSAGES_UPSERT') {
      const data = payload.data;

      // Evolution pode enviar array ou objeto único
      const messages = Array.isArray(data) ? data : [data];

      for (const msg of messages) {
        const key = msg.key;
        if (!key || key.fromMe) continue;

        const remoteJid = key.remoteJid;
        if (!remoteJid) continue;

        // Extrair número do remoteJid (5511999999999@s.whatsapp.net → 5511999999999)
        const from = remoteJid.replace(/@.*$/, '');
        const messageId = key.id || '';
        const contactName = msg.pushName || undefined;

        const message = msg.message;
        if (!message) continue;

        // Mensagem de texto
        const textContent =
          message.conversation ||
          message.extendedTextMessage?.text;

        if (textContent) {
          await this.webhookService.processIncomingMessage(
            botId,
            from,
            textContent,
            messageId,
            contactName,
          );
          continue;
        }

        // Respostas de lista interativa
        const listResponse = message.listResponseMessage;
        if (listResponse) {
          await this.webhookService.processInteractiveResponse(
            botId,
            from,
            'list_reply',
            listResponse.singleSelectReply?.selectedRowId || listResponse.title || '',
            listResponse.title || '',
            messageId,
            contactName,
          );
          continue;
        }

        // Respostas de botão
        const buttonResponse = message.buttonsResponseMessage;
        if (buttonResponse) {
          await this.webhookService.processInteractiveResponse(
            botId,
            from,
            'button_reply',
            buttonResponse.selectedButtonId || '',
            buttonResponse.selectedDisplayText || '',
            messageId,
            contactName,
          );
          continue;
        }
      }
    }

    if (payload.event === 'messages.update' || payload.event === 'MESSAGES_UPDATE') {
      const data = payload.data;
      const updates = Array.isArray(data) ? data : [data];

      for (const update of updates) {
        const messageId = update.key?.id;
        const status = update.update?.status;
        if (!messageId || status === undefined) continue;

        // Evolution status: 2=SENT, 3=DELIVERED, 4=READ
        const statusMap: Record<number, string> = {
          2: 'sent',
          3: 'delivered',
          4: 'read',
          5: 'read',
        };
        const mappedStatus = statusMap[status];
        if (mappedStatus) {
          await this.webhookService.processStatusUpdate(botId, messageId, mappedStatus);
        }
      }
    }

    return { status: 'ok' };
  }

  /** Emulador: processa mensagem pelo mesmo pipeline do WhatsApp real */
  @Post('emulator/:botId')
  @HttpCode(200)
  async handleEmulatorMessage(
    @Param('botId') botId: string,
    @Body() body: { text: string; sessionPhone: string },
  ) {
    this.logger.log(`Emulador: mensagem recebida para bot ${botId} — session ${body.sessionPhone}`);
    return this.webhookService.processEmulatorMessage(
      botId,
      body.text,
      body.sessionPhone,
    );
  }

  /** Emulador: reseta a conversa */
  @Delete('emulator/:botId/:sessionPhone')
  @HttpCode(200)
  async resetEmulatorConversation(
    @Param('botId') botId: string,
    @Param('sessionPhone') sessionPhone: string,
  ) {
    this.logger.log(`Emulador: resetando conversa para bot ${botId} — session ${sessionPhone}`);
    return this.webhookService.resetEmulatorConversation(botId, sessionPhone);
  }
}
