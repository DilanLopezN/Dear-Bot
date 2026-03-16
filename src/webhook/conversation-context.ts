import { VariableType } from '@prisma/client';

export interface ConversationContextVariable {
  name: string;
  type: VariableType;
  value: string;
  capturedAt: Date;
}

export interface ConversationContext {
  conversationId: string;
  botId: string;
  contactPhone: string;
  contactName: string | null;
  status: string;
  flowStepIndex: number;
  waitingForVariable: boolean;
  pendingVariableName: string | null;
  pendingVariableType: string | null;
  variables: Record<string, ConversationContextVariable>;
  createdAt: Date;
  lastMessageAt: Date;
  messageCount: number;
}

/** Serializa o contexto da conversa em um bloco de texto estruturado para enriquecer o prompt da IA */
export function serializeContextForAI(ctx: ConversationContext): string {
  const lines: string[] = [];

  lines.push('--- CONTEXTO DA CONVERSA ---');

  if (ctx.contactName) {
    lines.push(`Contato: ${ctx.contactName} (${ctx.contactPhone})`);
  } else {
    lines.push(`Contato: ${ctx.contactPhone}`);
  }

  lines.push(`Status: ${ctx.status} | Etapa do fluxo: ${ctx.flowStepIndex}`);
  lines.push(`Mensagens trocadas: ${ctx.messageCount}`);

  const elapsed = timeSince(ctx.createdAt);
  lines.push(`Conversa iniciada: ${elapsed}`);

  const varEntries = Object.values(ctx.variables);
  if (varEntries.length > 0) {
    lines.push('');
    lines.push('Variáveis capturadas:');
    for (const v of varEntries) {
      const ago = timeSince(v.capturedAt);
      lines.push(`  - ${v.name} (${v.type}) = "${v.value}" (capturado ${ago})`);
    }
  } else {
    lines.push('Nenhuma variável capturada ainda.');
  }

  if (ctx.waitingForVariable && ctx.pendingVariableName) {
    lines.push('');
    lines.push(`Aguardando captura: ${ctx.pendingVariableName} (${ctx.pendingVariableType})`);
  }

  lines.push('');
  lines.push('Instruções de contexto:');
  lines.push('- Não peça informações que já foram capturadas nas variáveis acima.');
  lines.push('- Se o nome do contato estiver disponível, use-o para personalizar a resposta.');
  lines.push('- Considere o ponto atual do fluxo ao direcionar a conversa.');
  lines.push('---');

  return lines.join('\n');
}

function timeSince(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return `${diffSec}s atrás`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}min atrás`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h atrás`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d atrás`;
}
