import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClaudeService {
  private readonly logger = new Logger(ClaudeService.name);
  private client: Anthropic;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    this.client = new Anthropic({
      apiKey: this.config.get('ANTHROPIC_API_KEY'),
    });
  }

  /** Gera resposta via Claude com contexto da conversa */
  async generateResponse(
    conversationId: string,
    userMessage: string,
    systemPrompt?: string,
  ): Promise<string> {
    try {
      // Busca últimas 20 mensagens para contexto
      const history = await this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        take: 20,
      });

      const messages: Anthropic.MessageParam[] = history.map((msg) => ({
        role: msg.direction === 'INBOUND' ? 'user' : 'assistant',
        content: msg.content,
      }));

      // Adiciona mensagem atual
      messages.push({ role: 'user', content: userMessage });

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt || 'Você é um assistente de atendimento ao cliente. Responda de forma educada, objetiva e útil. Responda no idioma do cliente.',
        messages,
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      return textBlock?.text || 'Desculpe, não consegui gerar uma resposta.';
    } catch (error) {
      this.logger.error(`Erro Claude API: ${error.message}`);
      return 'Desculpe, estou com dificuldades técnicas. Tente novamente em instantes.';
    }
  }
}
