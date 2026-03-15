import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  proto,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as path from 'path';
import * as fs from 'fs';

export interface BaileysConnectionInfo {
  sessionId: string;
  qrCode?: string;
  connected: boolean;
  phoneNumber?: string;
}

interface BaileysInstance {
  socket: WASocket;
  sessionId: string;
  connected: boolean;
}

@Injectable()
export class BaileysService implements OnModuleDestroy {
  private readonly logger = new Logger(BaileysService.name);
  private instances = new Map<string, BaileysInstance>();
  private sessionsDir: string;
  private webhookCallback?: (sessionId: string, event: string, data: any) => void;

  constructor(private config: ConfigService) {
    this.sessionsDir = config.get('BAILEYS_SESSIONS_DIR') || path.join(process.cwd(), '.baileys-sessions');
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  onModuleDestroy() {
    for (const [sessionId, instance] of this.instances) {
      try {
        instance.socket.end(undefined);
        this.logger.log(`Sessão Baileys '${sessionId}' encerrada`);
      } catch (e) {
        this.logger.warn(`Erro ao encerrar sessão '${sessionId}': ${e.message}`);
      }
    }
    this.instances.clear();
  }

  /** Registra callback para receber eventos de mensagem (usado pelo webhook) */
  setWebhookCallback(callback: (sessionId: string, event: string, data: any) => void) {
    this.webhookCallback = callback;
  }

  /** Cria/conecta uma sessão Baileys */
  async createSession(sessionId: string): Promise<BaileysConnectionInfo> {
    if (this.instances.has(sessionId)) {
      const instance = this.instances.get(sessionId)!;
      return {
        sessionId,
        connected: instance.connected,
      };
    }

    const sessionDir = path.join(this.sessionsDir, sessionId);
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const info: BaileysConnectionInfo = {
      sessionId,
      connected: false,
    };

    const socket = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: {
        level: 'silent',
        child: () => ({ level: 'silent' } as any),
        trace: () => {},
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        fatal: () => {},
      } as any,
    });

    const instance: BaileysInstance = {
      socket,
      sessionId,
      connected: false,
    };

    this.instances.set(sessionId, instance);

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        info.qrCode = qr;
        this.logger.log(`QR Code gerado para sessão '${sessionId}'`);
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        instance.connected = false;

        this.logger.warn(`Conexão encerrada para '${sessionId}', statusCode: ${statusCode}`);

        if (shouldReconnect) {
          this.logger.log(`Reconectando sessão '${sessionId}'...`);
          this.instances.delete(sessionId);
          this.createSession(sessionId).catch((err) => {
            this.logger.error(`Falha ao reconectar '${sessionId}': ${err.message}`);
          });
        } else {
          this.logger.log(`Sessão '${sessionId}' deslogada, removendo dados`);
          this.instances.delete(sessionId);
          this.deleteSessionData(sessionId);
        }
      }

      if (connection === 'open') {
        instance.connected = true;
        info.connected = true;
        this.logger.log(`Sessão '${sessionId}' conectada com sucesso`);
      }
    });

    socket.ev.on('messages.upsert', (m) => {
      if (this.webhookCallback) {
        this.webhookCallback(sessionId, 'messages.upsert', m);
      }
    });

    socket.ev.on('messages.update', (updates) => {
      if (this.webhookCallback) {
        this.webhookCallback(sessionId, 'messages.update', updates);
      }
    });

    return info;
  }

  /** Busca o QR Code para conectar */
  async getQrCode(sessionId: string): Promise<{ qrCode?: string; connected: boolean }> {
    const instance = this.instances.get(sessionId);
    if (!instance) {
      const info = await this.createSession(sessionId);
      // Aguarda um pouco para o QR ser gerado
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const inst = this.instances.get(sessionId);
      return {
        qrCode: info.qrCode,
        connected: inst?.connected || false,
      };
    }
    return {
      connected: instance.connected,
    };
  }

  /** Verifica estado da conexão */
  getConnectionState(sessionId: string): { connected: boolean; exists: boolean } {
    const instance = this.instances.get(sessionId);
    return {
      exists: !!instance,
      connected: instance?.connected || false,
    };
  }

  /** Envia mensagem de texto */
  async sendTextMessage(sessionId: string, to: string, text: string) {
    const instance = this.instances.get(sessionId);
    if (!instance?.connected) {
      throw new Error(`Sessão Baileys '${sessionId}' não está conectada`);
    }

    const jid = this.formatJid(to);
    const result = await instance.socket.sendMessage(jid, { text });
    this.logger.log(`Mensagem enviada para ${to} via Baileys`);
    return result;
  }

  /** Envia mensagem interativa com lista */
  async sendInteractiveListMessage(
    sessionId: string,
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
    const instance = this.instances.get(sessionId);
    if (!instance?.connected) {
      throw new Error(`Sessão Baileys '${sessionId}' não está conectada`);
    }

    const jid = this.formatJid(to);
    const listMessage = {
      text: description,
      footer: footer || '',
      title,
      buttonText,
      sections,
    };

    const result = await instance.socket.sendMessage(jid, listMessage as any);
    this.logger.log(`Menu interativo enviado para ${to} via Baileys`);
    return result;
  }

  /** Envia mensagem interativa com botões */
  async sendInteractiveButtonMessage(
    sessionId: string,
    to: string,
    body: string,
    buttons: Array<{ buttonId: string; buttonText: { displayText: string } }>,
  ) {
    const instance = this.instances.get(sessionId);
    if (!instance?.connected) {
      throw new Error(`Sessão Baileys '${sessionId}' não está conectada`);
    }

    const jid = this.formatJid(to);
    const buttonMessage = {
      text: body,
      buttons,
      headerType: 1,
    };

    const result = await instance.socket.sendMessage(jid, buttonMessage as any);
    this.logger.log(`Botões interativos enviados para ${to} via Baileys`);
    return result;
  }

  /** Marca mensagem como lida */
  async markAsRead(sessionId: string, remoteJid: string, messageId: string) {
    const instance = this.instances.get(sessionId);
    if (!instance?.connected) return;

    try {
      await instance.socket.readMessages([
        { remoteJid: this.formatJid(remoteJid), id: messageId },
      ]);
    } catch (error) {
      this.logger.warn(`Erro ao marcar como lida via Baileys: ${error.message}`);
    }
  }

  /** Desconecta e remove sessão */
  async deleteSession(sessionId: string) {
    const instance = this.instances.get(sessionId);
    if (instance) {
      try {
        await instance.socket.logout();
      } catch (e) {
        this.logger.warn(`Erro ao deslogar sessão '${sessionId}': ${e.message}`);
      }
      this.instances.delete(sessionId);
    }
    this.deleteSessionData(sessionId);
    this.logger.log(`Sessão Baileys '${sessionId}' removida`);
  }

  /** Desconecta a sessão sem apagar dados */
  async logoutSession(sessionId: string) {
    const instance = this.instances.get(sessionId);
    if (instance) {
      try {
        await instance.socket.logout();
      } catch (e) {
        this.logger.warn(`Erro ao deslogar sessão '${sessionId}': ${e.message}`);
      }
      this.instances.delete(sessionId);
    }
    this.logger.log(`Sessão Baileys '${sessionId}' desconectada`);
  }

  /** Formata número para JID do WhatsApp */
  private formatJid(number: string): string {
    const cleaned = number.replace(/\D/g, '');
    return `${cleaned}@s.whatsapp.net`;
  }

  /** Remove dados da sessão do disco */
  private deleteSessionData(sessionId: string) {
    const sessionDir = path.join(this.sessionsDir, sessionId);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
  }
}
