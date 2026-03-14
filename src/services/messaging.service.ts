import { Injectable, Logger } from '@nestjs/common';
import { Dialog360Service } from './dialog360.service';
import { EvolutionService } from './evolution.service';

export interface ChannelConfig {
  provider: 'DIALOG360' | 'EVOLUTION';
  dialog360ApiKey?: string | null;
  evolutionApiUrl?: string | null;
  evolutionApiKey?: string | null;
  evolutionInstance?: string | null;
}

export interface SendResult {
  messageId?: string;
}

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private dialog360: Dialog360Service,
    private evolution: EvolutionService,
  ) {}

  async sendTextMessage(channel: ChannelConfig, to: string, text: string): Promise<SendResult> {
    if (channel.provider === 'EVOLUTION') {
      const result = await this.evolution.sendTextMessage(
        channel.evolutionApiUrl!,
        channel.evolutionApiKey!,
        channel.evolutionInstance!,
        to,
        text,
      );
      return { messageId: result?.key?.id };
    }

    const result = await this.dialog360.sendTextMessage(channel.dialog360ApiKey!, to, text);
    return { messageId: result?.messages?.[0]?.id };
  }

  async sendInteractiveListMessage(
    channel: ChannelConfig,
    to: string,
    header: string,
    body: string,
    footer: string | undefined,
    buttonText: string,
    sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>,
  ): Promise<SendResult> {
    if (channel.provider === 'EVOLUTION') {
      const evoSections = sections.map((s) => ({
        title: s.title,
        rows: s.rows.map((r) => ({ title: r.title, description: r.description, rowId: r.id })),
      }));
      const result = await this.evolution.sendInteractiveListMessage(
        channel.evolutionApiUrl!,
        channel.evolutionApiKey!,
        channel.evolutionInstance!,
        to,
        header,
        body,
        footer,
        buttonText,
        evoSections,
      );
      return { messageId: result?.key?.id };
    }

    const result = await this.dialog360.sendInteractiveListMessage(
      channel.dialog360ApiKey!,
      to,
      header,
      body,
      footer,
      buttonText,
      sections,
    );
    return { messageId: result?.messages?.[0]?.id };
  }

  async sendInteractiveButtonMessage(
    channel: ChannelConfig,
    to: string,
    body: string,
    buttons: Array<{ id: string; title: string }>,
  ): Promise<SendResult> {
    if (channel.provider === 'EVOLUTION') {
      const evoButtons = buttons.map((b) => ({
        buttonId: b.id,
        buttonText: { displayText: b.title },
      }));
      const result = await this.evolution.sendInteractiveButtonMessage(
        channel.evolutionApiUrl!,
        channel.evolutionApiKey!,
        channel.evolutionInstance!,
        to,
        body,
        evoButtons,
      );
      return { messageId: result?.key?.id };
    }

    const result = await this.dialog360.sendInteractiveButtonMessage(
      channel.dialog360ApiKey!,
      to,
      body,
      buttons,
    );
    return { messageId: result?.messages?.[0]?.id };
  }

  async markAsRead(channel: ChannelConfig, messageId: string): Promise<void> {
    if (channel.provider === 'EVOLUTION') {
      // Evolution API marca como lido automaticamente ou não tem endpoint dedicado
      return;
    }
    await this.dialog360.markAsRead(channel.dialog360ApiKey!, messageId);
  }

  /** Extrai ChannelConfig de um WhatsappChannel do Prisma */
  static fromChannel(ch: any): ChannelConfig {
    return {
      provider: ch.provider || 'DIALOG360',
      dialog360ApiKey: ch.dialog360ApiKey,
      evolutionApiUrl: ch.evolutionApiUrl,
      evolutionApiKey: ch.evolutionApiKey,
      evolutionInstance: ch.evolutionInstance,
    };
  }
}
