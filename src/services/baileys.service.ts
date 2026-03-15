import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

/**
 * BaileysService — integração com um servidor HTTP que expõe a lib @whiskeysockets/baileys.
 * Este serviço é compatível com servidores Baileys HTTP como WPPConnect REST,
 * Z-API, ou qualquer servidor customizado que siga a interface abaixo.
 *
 * Endpoints esperados pelo servidor Baileys HTTP:
 *   POST /message/sendText/:instance   { number, text }
 *   POST /message/sendList/:instance   { number, title, description, footerText, buttonText, sections }
 *   POST /message/sendButtons/:instance { number, title, description, buttons }
 *   GET  /instance/connect/:instance   → retorna { qrcode }
 *   GET  /instance/connectionState/:instance → retorna { state }
 */
@Injectable()
export class BaileysService {
  private readonly logger = new Logger(BaileysService.name);

  private getClient(baseUrl: string, apiKey: string): AxiosInstance {
    return axios.create({
      baseURL: baseUrl,
      headers: {
        apikey: apiKey,
        'Content-Type': 'application/json',
      },
    });
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
      this.logger.log(`[Baileys] Mensagem enviada para ${to}`);
      return response.data;
    } catch (error) {
      this.logger.error(`[Baileys] Erro ao enviar mensagem: ${error.message}`);
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
      this.logger.log(`[Baileys] Lista interativa enviada para ${to}`);
      return response.data;
    } catch (error) {
      this.logger.error(`[Baileys] Erro ao enviar lista: ${error.message}`);
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
      this.logger.log(`[Baileys] Botões enviados para ${to}`);
      return response.data;
    } catch (error) {
      this.logger.error(`[Baileys] Erro ao enviar botões: ${error.message}`);
      throw error;
    }
  }

  /** Obtém QR Code para conexão */
  async getQrCode(baseUrl: string, apiKey: string, instanceName: string) {
    const client = this.getClient(baseUrl, apiKey);
    try {
      const response = await client.get(`/instance/connect/${instanceName}`);
      return response.data;
    } catch (error) {
      this.logger.error(`[Baileys] Erro ao obter QR Code: ${error.message}`);
      throw error;
    }
  }

  /** Verifica estado da conexão */
  async getConnectionState(baseUrl: string, apiKey: string, instanceName: string) {
    const client = this.getClient(baseUrl, apiKey);
    try {
      const response = await client.get(`/instance/connectionState/${instanceName}`);
      return response.data;
    } catch (error) {
      this.logger.error(`[Baileys] Erro ao verificar conexão: ${error.message}`);
      throw error;
    }
  }
}
