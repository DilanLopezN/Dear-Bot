import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class Dialog360Service {
  private readonly logger = new Logger(Dialog360Service.name);
  private baseUrl: string;

  constructor(private config: ConfigService) {
    this.baseUrl = config.get('DIALOG360_API_URL') || 'https://waba.360dialog.io/v1';
  }

  private getClient(apiKey: string): AxiosInstance {
    return axios.create({
      baseURL: this.baseUrl,
      headers: {
        'D360-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  /** Envia mensagem de texto via WhatsApp */
  async sendTextMessage(apiKey: string, to: string, text: string) {
    const client = this.getClient(apiKey);
    try {
      const response = await client.post('/messages', {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: text },
      });
      this.logger.log(`Mensagem enviada para ${to}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Erro ao enviar mensagem: ${error.message}`);
      throw error;
    }
  }

  /** Configura webhook no Dialog360 */
  async setWebhook(apiKey: string, url: string) {
    const client = this.getClient(apiKey);
    try {
      await client.post('/configs/webhook', { url });
      this.logger.log(`Webhook configurado: ${url}`);
    } catch (error) {
      this.logger.error(`Erro ao configurar webhook: ${error.message}`);
      throw error;
    }
  }

  /** Envia mensagem interativa com lista de opções via WhatsApp */
  async sendInteractiveListMessage(
    apiKey: string,
    to: string,
    header: string,
    body: string,
    footer: string | undefined,
    buttonText: string,
    sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>,
  ) {
    const client = this.getClient(apiKey);
    try {
      const response = await client.post('/messages', {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: 'list',
          header: { type: 'text', text: header },
          body: { text: body },
          ...(footer ? { footer: { text: footer } } : {}),
          action: {
            button: buttonText,
            sections,
          },
        },
      });
      this.logger.log(`Menu interativo enviado para ${to}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Erro ao enviar menu interativo: ${error.message}`);
      throw error;
    }
  }

  /** Envia mensagem interativa com botões de resposta rápida */
  async sendInteractiveButtonMessage(
    apiKey: string,
    to: string,
    body: string,
    buttons: Array<{ id: string; title: string }>,
  ) {
    const client = this.getClient(apiKey);
    try {
      const response = await client.post('/messages', {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: body },
          action: {
            buttons: buttons.map((btn) => ({
              type: 'reply',
              reply: { id: btn.id, title: btn.title },
            })),
          },
        },
      });
      this.logger.log(`Botões interativos enviados para ${to}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Erro ao enviar botões: ${error.message}`);
      throw error;
    }
  }

  /** Marca mensagem como lida */
  async markAsRead(apiKey: string, messageId: string) {
    const client = this.getClient(apiKey);
    try {
      await client.post('/messages', {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      });
    } catch (error) {
      this.logger.error(`Erro ao marcar como lida: ${error.message}`);
    }
  }
}
