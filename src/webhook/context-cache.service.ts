import { Injectable, Logger } from '@nestjs/common';
import { ConversationContext, ConversationContextVariable } from './conversation-context';

interface CacheEntry {
  context: ConversationContext;
  expiresAt: number;
}

@Injectable()
export class ContextCacheService {
  private readonly logger = new Logger(ContextCacheService.name);
  private cache = new Map<string, CacheEntry>();
  private readonly TTL_MS = 30 * 60 * 1000; // 30 minutos
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Limpar entradas expiradas a cada 5 minutos
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  onModuleDestroy() {
    clearInterval(this.cleanupInterval);
  }

  get(conversationId: string): ConversationContext | null {
    const entry = this.cache.get(conversationId);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(conversationId);
      return null;
    }

    return entry.context;
  }

  set(conversationId: string, context: ConversationContext): void {
    this.cache.set(conversationId, {
      context,
      expiresAt: Date.now() + this.TTL_MS,
    });
  }

  invalidate(conversationId: string): void {
    this.cache.delete(conversationId);
  }

  /** Atualiza uma variável no contexto cacheado sem reconstruir tudo */
  updateVariable(conversationId: string, name: string, variable: ConversationContextVariable): void {
    const entry = this.cache.get(conversationId);
    if (!entry || Date.now() > entry.expiresAt) return;

    entry.context.variables[name] = variable;
    entry.expiresAt = Date.now() + this.TTL_MS; // renova TTL
  }

  /** Atualiza campos do contexto cacheado */
  updateContext(conversationId: string, updates: Partial<ConversationContext>): void {
    const entry = this.cache.get(conversationId);
    if (!entry || Date.now() > entry.expiresAt) return;

    Object.assign(entry.context, updates);
    entry.expiresAt = Date.now() + this.TTL_MS;
  }

  private cleanup(): void {
    const now = Date.now();
    let removed = 0;
    for (const [id, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(id);
        removed++;
      }
    }
    if (removed > 0) {
      this.logger.debug(`Cache cleanup: ${removed} entradas removidas, ${this.cache.size} restantes`);
    }
  }
}
