import { Controller, Post, Param, Body, Logger, HttpCode, OnModuleInit } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { BaileysService } from '../services/baileys.service';
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
export class WebhookController implements OnModuleInit {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private webhookService: WebhookService,
    private baileysService: BaileysService,
    private prisma: PrismaService,
  ) {}

  async onModuleInit() {
    // Registra callback do Baileys para processar mensagens recebidas
    this.baileysService.setWebhookCallback(
      async (sessionId: string, event: string, data: any) => {
        try {
          await this.handleBaileysEvent(sessionId, event, data);
        } catch (error) {
          this.logger.error(`Erro ao processar evento Baileys: ${error.message}`, error.stack);
        }
      },
    );

    // Reconecta sessões Baileys existentes
    const baileysChannels = await this.prisma.whatsappChannel.findMany({
      where: { provider: 'BAILEYS' },
    });

    for (const channel of baileysChannels) {
      if (channel.baileysSessionId) {
        try {
          await this.baileysService.createSession(channel.baileysSessionId);
          this.logger.log(`Sessão Baileys '${channel.baileysSessionId}' reconectada no startup`);
        } catch (error) {
          this.logger.warn(`Falha ao reconectar sessão Baileys '${channel.baileysSessionId}': ${error.message}`);
        }
      }
    }
  }

  /** Processa eventos internos do Baileys */
  private async handleBaileysEvent(sessionId: string, event: string, data: any) {
    // Busca o canal pelo sessionId
    const channel = await this.prisma.whatsappChannel.findFirst({
      where: { baileysSessionId: sessionId, provider: 'BAILEYS' },
    });

    if (!channel) {
      this.logger.warn(`Canal Baileys não encontrado para sessão '${sessionId}'`);
      return;
    }

    const botId = channel.botId;

    if (event === 'messages.upsert') {
      const messages = data.messages || [];

      for (const msg of messages) {
        const key = msg.key;
        if (!key || key.fromMe) continue;

        const remoteJid = key.remoteJid;
        if (!remoteJid || remoteJid.endsWith('@g.us')) continue; // Ignora grupos

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

    if (event === 'messages.update') {
      const updates = Array.isArray(data) ? data : [data];

      for (const update of updates) {
        const messageId = update.key?.id;
        const status = update.update?.status;
        if (!messageId || status === undefined) continue;

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
  }

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
}
