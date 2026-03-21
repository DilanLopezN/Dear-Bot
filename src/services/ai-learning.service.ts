import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface LearningEntry {
  botId: string;
  contactPhone?: string;
  type: 'INTERACTION' | 'PATTERN' | 'PREFERENCE' | 'SUMMARY';
  content: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class AiLearningService {
  private readonly logger = new Logger(AiLearningService.name);

  constructor(private prisma: PrismaService) {}

  /** Salva um aprendizado da IA para o bot */
  async saveLearning(entry: LearningEntry) {
    try {
      await this.prisma.aiLearning.create({
        data: {
          botId: entry.botId,
          contactPhone: entry.contactPhone || null,
          type: entry.type,
          content: entry.content,
          metadata: entry.metadata ? (entry.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
        },
      });
    } catch (error) {
      this.logger.warn(`Erro ao salvar aprendizado: ${error.message}`);
    }
  }

  /** Salva interação como aprendizado após resposta de IA */
  async saveInteractionLearning(
    botId: string,
    contactPhone: string,
    userMessage: string,
    aiResponse: string,
    contactName?: string,
  ) {
    const content = `Pergunta: ${userMessage}\nResposta: ${aiResponse}`;
    const metadata: Record<string, any> = {
      contactName: contactName || null,
      timestamp: new Date().toISOString(),
      messageLength: userMessage.length,
      responseLength: aiResponse.length,
    };

    // Extrair tópicos simples da mensagem do usuário
    const topics = this.extractTopics(userMessage);
    if (topics.length > 0) {
      metadata.topics = topics;
    }

    await this.saveLearning({
      botId,
      contactPhone,
      type: 'INTERACTION',
      content,
      metadata,
    });

    // Verificar se já temos interações suficientes para gerar um resumo
    await this.checkAndGenerateSummary(botId, contactPhone);
  }

  /** Extrai tópicos simples baseado em palavras-chave comuns */
  private extractTopics(text: string): string[] {
    const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const topicKeywords: Record<string, string[]> = {
      preco: ['preco', 'valor', 'custo', 'quanto', 'pagamento', 'pagar'],
      produto: ['produto', 'servico', 'catalogo', 'item', 'comprar'],
      suporte: ['problema', 'erro', 'ajuda', 'suporte', 'bug', 'nao funciona'],
      horario: ['horario', 'funcionamento', 'aberto', 'fechado', 'hora'],
      entrega: ['entrega', 'frete', 'envio', 'prazo', 'chegada'],
      duvida: ['como', 'onde', 'quando', 'porque', 'qual'],
      reclamacao: ['reclamacao', 'insatisfeito', 'ruim', 'pessimo', 'cancelar'],
      elogio: ['otimo', 'excelente', 'parabens', 'obrigado', 'adorei'],
    };

    const found: string[] = [];
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some((kw) => normalized.includes(kw))) {
        found.push(topic);
      }
    }
    return found;
  }

  /** Gera um resumo consolidado quando há interações suficientes */
  private async checkAndGenerateSummary(botId: string, contactPhone: string) {
    const interactionCount = await this.prisma.aiLearning.count({
      where: { botId, contactPhone, type: 'INTERACTION' },
    });

    // A cada 10 interações, gerar um resumo
    if (interactionCount > 0 && interactionCount % 10 === 0) {
      const recentInteractions = await this.prisma.aiLearning.findMany({
        where: { botId, contactPhone, type: 'INTERACTION' },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      // Extrair padrões das interações
      const allTopics: string[] = [];
      for (const interaction of recentInteractions) {
        const meta = interaction.metadata as any;
        if (meta?.topics) {
          allTopics.push(...meta.topics);
        }
      }

      // Contar frequência dos tópicos
      const topicFreq: Record<string, number> = {};
      for (const topic of allTopics) {
        topicFreq[topic] = (topicFreq[topic] || 0) + 1;
      }

      const topTopics = Object.entries(topicFreq)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([t]) => t);

      if (topTopics.length > 0) {
        const summaryContent = `Resumo de ${interactionCount} interações com ${contactPhone}: Tópicos frequentes: ${topTopics.join(', ')}. Total de interações analisadas: ${recentInteractions.length}.`;

        await this.saveLearning({
          botId,
          contactPhone,
          type: 'SUMMARY',
          content: summaryContent,
          metadata: { topicFrequency: topicFreq, totalInteractions: interactionCount },
        });

        this.logger.log(`Resumo de aprendizado gerado para bot ${botId}, contato ${contactPhone}`);
      }
    }
  }

  /** Recupera aprendizados relevantes para enriquecer o prompt da IA */
  async getLearningContext(botId: string, contactPhone?: string): Promise<string | undefined> {
    const lines: string[] = [];

    // 1. Buscar resumos globais do bot (últimos 5)
    const globalSummaries = await this.prisma.aiLearning.findMany({
      where: { botId, contactPhone: null, type: 'SUMMARY' },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    // 2. Buscar padrões globais do bot
    const globalPatterns = await this.prisma.aiLearning.findMany({
      where: { botId, contactPhone: null, type: 'PATTERN' },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // 3. Se temos um contato específico, buscar aprendizados dele
    let contactLearnings: any[] = [];
    let contactPreferences: any[] = [];
    if (contactPhone) {
      // Resumos do contato
      contactLearnings = await this.prisma.aiLearning.findMany({
        where: { botId, contactPhone, type: 'SUMMARY' },
        orderBy: { createdAt: 'desc' },
        take: 3,
      });

      // Preferências do contato
      contactPreferences = await this.prisma.aiLearning.findMany({
        where: { botId, contactPhone, type: 'PREFERENCE' },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

      // Últimas interações do contato (para contexto recente)
      const recentInteractions = await this.prisma.aiLearning.findMany({
        where: { botId, contactPhone, type: 'INTERACTION' },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

      if (recentInteractions.length > 0) {
        lines.push('## Histórico de Interações Recentes com Este Contato');
        for (const interaction of recentInteractions.reverse()) {
          lines.push(`- ${interaction.content}`);
        }
        lines.push('');
      }
    }

    // Montar contexto de aprendizado
    if (contactPreferences.length > 0) {
      lines.push('## Preferências Conhecidas do Contato');
      for (const pref of contactPreferences) {
        lines.push(`- ${pref.content}`);
      }
      lines.push('');
    }

    if (contactLearnings.length > 0) {
      lines.push('## Resumo de Atendimentos Anteriores com Este Contato');
      for (const learning of contactLearnings) {
        lines.push(`- ${learning.content}`);
      }
      lines.push('');
    }

    if (globalPatterns.length > 0) {
      lines.push('## Padrões Identificados no Atendimento');
      for (const pattern of globalPatterns) {
        lines.push(`- ${pattern.content}`);
      }
      lines.push('');
    }

    if (globalSummaries.length > 0) {
      lines.push('## Aprendizados Gerais do Bot');
      for (const summary of globalSummaries) {
        lines.push(`- ${summary.content}`);
      }
      lines.push('');
    }

    if (lines.length === 0) return undefined;

    lines.unshift('## Memória e Aprendizados da IA');
    lines.push('Instrução: Use estas informações para personalizar o atendimento. Considere o histórico, preferências e padrões do contato ao formular suas respostas. Não mencione explicitamente que possui esta memória, apenas use-a naturalmente.');

    return lines.join('\n');
  }

  /** Salva um padrão ou preferência aprendida via análise da IA */
  async savePatternFromAI(
    botId: string,
    contactPhone: string | null,
    pattern: string,
    metadata?: Record<string, any>,
  ) {
    await this.saveLearning({
      botId,
      contactPhone: contactPhone || undefined,
      type: contactPhone ? 'PREFERENCE' : 'PATTERN',
      content: pattern,
      metadata,
    });
  }
}
