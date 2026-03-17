import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClaudeService {
  private readonly logger = new Logger(ClaudeService.name);

  constructor(private prisma: PrismaService) {}

  /** Gera resposta via Claude com contexto da conversa */
  async generateResponse(
    conversationId: string,
    userMessage: string,
    systemPrompt?: string,
    apiKey?: string,
    model?: string,
    maxTokens?: number,
    temperature?: number,
  ): Promise<string> {
    if (!apiKey) {
      return 'Claude API key não configurada. Configure nas configurações de I.A.';
    }

    try {
      const client = new Anthropic({ apiKey });

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

      const response = await client.messages.create({
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: maxTokens || 1024,
        temperature: temperature ?? 0.7,
        system: systemPrompt || 'Você é um assistente de atendimento ao cliente. Responda de forma educada, objetiva e útil. Responda no idioma do cliente.',
        messages,
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      return textBlock?.text || 'Desculpe, não consegui gerar uma resposta.';
    } catch (error) {
      this.logger.error(`Erro Claude API: ${error.status} ${error.message}`);
      return 'Desculpe, estou com dificuldades técnicas. Tente novamente em instantes.';
    }
  }
}
