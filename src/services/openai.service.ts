import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);

  constructor(private prisma: PrismaService) {}

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
      return 'OpenAI API key não configurada. Configure nas configurações de I.A.';
    }

    try {
      const client = new OpenAI({ apiKey });

      const history = await this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        take: 20,
      });

      const messages: OpenAI.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: systemPrompt || 'Você é um assistente de atendimento ao cliente. Responda de forma educada, objetiva e útil. Responda no idioma do cliente.',
        },
        ...history.map((msg) => ({
          role: (msg.direction === 'INBOUND' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: msg.content,
        })),
        { role: 'user', content: userMessage },
      ];

      const response = await client.chat.completions.create({
        model: model || 'gpt-4o',
        max_tokens: maxTokens || 1024,
        temperature: temperature ?? 0.7,
        messages,
      });

      return response.choices[0]?.message?.content || 'Desculpe, não consegui gerar uma resposta.';
    } catch (error) {
      this.logger.error(`Erro OpenAI API: ${error.message}`);
      return 'Desculpe, estou com dificuldades técnicas. Tente novamente em instantes.';
    }
  }
}
