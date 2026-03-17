import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class EvolutionService {
  private readonly logger = new Logger(EvolutionService.name);

  private getClient(baseUrl: string, apiKey: string): AxiosInstance {
    return axios.create({
      baseURL: baseUrl,
      headers: {
        apikey: apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  /** Cria uma instância na Evolution API */
  async createInstance(
    baseUrl: string,
    apiKey: string,
    instanceName: string,
    webhookUrl: string,
  ) {
    const client = this.getClient(baseUrl, apiKey);
    try {
      const response = await client.post('/instance/create', {
        instanceName,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
        webhook: {
          url: webhookUrl,
          byEvents: false,
          base64: false,
          events: [
            'MESSAGES_UPSERT',
            'MESSAGES_UPDATE',
            'CONNECTION_UPDATE',
          ],
        },
      });
      this.logger.log(`Instância '${instanceName}' criada`);
      return response.data;
    } catch (error) {
      this.logger.error(`Erro ao criar instância: ${error.message}`);
      throw error;
    }
  }

  /** Busca o QR Code para conectar o WhatsApp */
  async getQrCode(baseUrl: string, apiKey: string, instanceName: string) {
    const client = this.getClient(baseUrl, apiKey);
    try {
      const response = await client.get(`/instance/connect/${instanceName}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Erro ao obter QR Code: ${error.message}`);
      throw error;
    }
  }

  /** Verifica o estado da conexão */
  async getConnectionState(baseUrl: string, apiKey: string, instanceName: string) {
    const client = this.getClient(baseUrl, apiKey);
    try {
      const response = await client.get(`/instance/connectionState/${instanceName}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Erro ao verificar estado da conexão: ${error.message}`);
      throw error;
    }
  }

  /** Envia mensagem de texto */
  async sendTextMessage(
    baseUrl: string,
    apiKey: string,
    instanceName: string,
    to: string,
    text: string,
  ) {
    const client = this.getClient(baseUrl, apiKey);
    try {
      const response = await client.post(`/message/sendText/${instanceName}`, {
        number: to,
        text,
      });
      this.logger.log(`Mensagem enviada para ${to} via Evolution`);
      return response.data;
    } catch (error) {
      this.logger.error(`Erro ao enviar mensagem Evolution: ${error.message}`);
      throw error;
    }
  }

  /** Envia mensagem interativa com lista */
  async sendInteractiveListMessage(
    baseUrl: string,
    apiKey: string,
    instanceName: string,
    to: string,
    title: string,
    description: string,
    footer: string | undefined,
    buttonText: string,
    sections: Array<{
      title: string;
      rows: Array<{ title: string; description?: string; rowId: string }>;
    }>,
  ) {
    const client = this.getClient(baseUrl, apiKey);
    try {
      const response = await client.post(`/message/sendList/${instanceName}`, {
        number: to,
        title,
        description,
        footerText: footer || '',
        buttonText,
        sections,
      });
      this.logger.log(`Menu interativo enviado para ${to} via Evolution`);
      return response.data;
    } catch (error) {
      this.logger.error(`Erro ao enviar menu interativo Evolution: ${error.message}`);
      throw error;
    }
  }

  /** Envia mensagem interativa com botões */
  async sendInteractiveButtonMessage(
    baseUrl: string,
    apiKey: string,
    instanceName: string,
    to: string,
    body: string,
    buttons: Array<{ buttonId: string; buttonText: { displayText: string } }>,
  ) {
    const client = this.getClient(baseUrl, apiKey);
    try {
      const response = await client.post(`/message/sendButtons/${instanceName}`, {
        number: to,
        title: '',
        description: body,
        buttons,
      });
      this.logger.log(`Botões interativos enviados para ${to} via Evolution`);
      return response.data;
    } catch (error) {
      this.logger.error(`Erro ao enviar botões Evolution: ${error.message}`);
      throw error;
    }
  }

  /** Envia mídia (imagem, documento, vídeo, áudio) */
  async sendMediaMessage(
    baseUrl: string,
    apiKey: string,
    instanceName: string,
    to: string,
    mediaType: 'image' | 'document' | 'video' | 'audio',
    mediaUrl: string,
    caption?: string,
    filename?: string,
  ) {
    const client = this.getClient(baseUrl, apiKey);
    try {
      const response = await client.post(`/message/sendMedia/${instanceName}`, {
        number: to,
        mediatype: mediaType,
        media: mediaUrl,
        caption: caption || '',
        fileName: filename || '',
      });
      this.logger.log(`Mídia (${mediaType}) enviada para ${to} via Evolution`);
      return response.data;
    } catch (error) {
      this.logger.error(`Erro ao enviar mídia Evolution: ${error.message}`);
      throw error;
    }
  }

  /** Configura webhook da instância */
  async setWebhook(
    baseUrl: string,
    apiKey: string,
    instanceName: string,
    webhookUrl: string,
  ) {
    const client = this.getClient(baseUrl, apiKey);
    try {
      await client.post(`/webhook/set/${instanceName}`, {
        webhook: {
          enabled: true,
          url: webhookUrl,
          webhookByEvents: false,
          webhookBase64: false,
          events: [
            'MESSAGES_UPSERT',
            'MESSAGES_UPDATE',
            'CONNECTION_UPDATE',
          ],
        },
      });
      this.logger.log(`Webhook configurado para instância '${instanceName}'`);
    } catch (error) {
      const detail = error.response?.data
        ? JSON.stringify(error.response.data)
        : error.message;
      this.logger.error(`Erro ao configurar webhook Evolution: ${detail}`);
      console.log('WHTSERRO', error);
      throw error;
    }
  }

  /** Remove instância */
  async deleteInstance(baseUrl: string, apiKey: string, instanceName: string) {
    const client = this.getClient(baseUrl, apiKey);
    try {
      await client.delete(`/instance/delete/${instanceName}`);
      this.logger.log(`Instância '${instanceName}' removida`);
    } catch (error) {
      this.logger.error(`Erro ao remover instância: ${error.message}`);
      throw error;
    }
  }

  /** Desconectar (logout) instância */
  async logoutInstance(baseUrl: string, apiKey: string, instanceName: string) {
    const client = this.getClient(baseUrl, apiKey);
    try {
      await client.delete(`/instance/logout/${instanceName}`);
      this.logger.log(`Instância '${instanceName}' desconectada`);
    } catch (error) {
      this.logger.error(`Erro ao desconectar instância: ${error.message}`);
      throw error;
    }
  }
}
