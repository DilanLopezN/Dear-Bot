import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);

  constructor(private prisma: PrismaService) {}

  async generateResponse(
    conversationId: string,
    userMessage: string,
    systemPrompt?: string,
    apiKey?: string,
    model?: string,
    maxTokens?: number,
    temperature?: number,
    knowledgeContext?: string,
  ): Promise<string> {
    if (!apiKey) {
      return 'Gemini API key não configurada. Configure nas configurações de I.A.';
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      let finalSystemPrompt = systemPrompt || 'Você é um assistente de atendimento ao cliente. Responda de forma educada, objetiva e útil. Responda no idioma do cliente.';
      if (knowledgeContext) {
        finalSystemPrompt += `\n\n## Base de Conhecimento\nUse as informações abaixo para responder às perguntas do usuário. Baseie suas respostas neste conhecimento quando relevante:\n\n${knowledgeContext}`;
      }

      const genModel = genAI.getGenerativeModel({
        model: model || 'gemini-2.0-flash',
        systemInstruction: finalSystemPrompt,
        generationConfig: {
          maxOutputTokens: maxTokens || 1024,
          temperature: temperature ?? 0.7,
        },
      });

      const history = await this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        take: 20,
      });

      const chatHistory = history.map((msg) => ({
        role: msg.direction === 'INBOUND' ? 'user' as const : 'model' as const,
        parts: [{ text: msg.content }],
      }));

      const chat = genModel.startChat({ history: chatHistory });
      const result = await chat.sendMessage(userMessage);
      const response = result.response;

      return response.text() || 'Desculpe, não consegui gerar uma resposta.';
    } catch (error) {
      this.logger.error(`Erro Gemini API: ${error.message}`);
      return 'Desculpe, estou com dificuldades técnicas. Tente novamente em instantes.';
    }
  }
}
