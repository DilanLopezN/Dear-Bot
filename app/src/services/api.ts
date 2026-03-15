import axios, { AxiosInstance, AxiosError } from 'axios';

export interface DashboardOverview {
  totals: {
    totalBots: number;
    activeBots: number;
    connectedBots: number;
    totalConversations: number;
    totalMessages: number;
  };
  dailyMetrics: Array<{ name: string; mensagens: number; conversas: number }>;
  recentBots: any[];
}

export interface ReportsAnalytics {
  botStats: Array<{ name: string; conversas: number; mensagens: number }>;
  modeDistribution: Array<{ name: string; value: number }>;
  totals: {
    totalBots: number;
    totalConversas: number;
    totalMensagens: number;
    mediaMsgPorBot: number;
  };
}

export interface MonthlyMetric {
  date: string;
  mensagens: number;
  conversas: number;
  inbound: number;
  outbound: number;
}

export interface GotoTarget {
  type: 'MENU' | 'KEYWORD';
  target: string;
}

export interface MenuOption {
  id: string;
  title: string;
  description?: string;
  goto?: GotoTarget;
}

export interface Keyword {
  id: string;
  botId: string;
  trigger: string;
  response: string;
  priority: number;
  isActive: boolean;
  goto?: GotoTarget;
  createdAt: string;
}

export interface FlowStep {
  type: 'GOTO_MENU' | 'GOTO_KEYWORD';
  menuTrigger?: string;
  keywordTrigger?: string;
}

export interface FlowConfig {
  initialInteraction?: GotoTarget;
  steps?: FlowStep[];
  fallback?: {
    message: string;
    goto?: GotoTarget;
  };
}

export interface InteractiveMenu {
  id: string;
  botId: string;
  trigger: string;
  title: string;
  body?: string;
  footer?: string;
  options: MenuOption[];
  isActive: boolean;
  createdAt: string;
}

export interface ChatConversation {
  id: string;
  botId: string;
  botName: string;
  botResponseMode: string;
  contactPhone: string;
  contactName: string | null;
  status: 'BOT' | 'WAITING' | 'HUMAN' | 'CLOSED';
  humanTakeoverAt: string | null;
  lastMessageAt: string;
  messageCount: number;
  lastMessage: ChatMessage | null;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  content: string;
  status: string;
  senderType: 'CONTACT' | 'BOT' | 'HUMAN';
  dialog360MsgId: string | null;
  createdAt: string;
}

/** Extrai a mensagem de erro de uma resposta axios de forma legível */
export function extractApiError(err: unknown): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data;
    if (data) {
      if (typeof data.message === 'string') return data.message;
      if (Array.isArray(data.message)) return data.message.join('; ');
      if (typeof data.error === 'string') return data.error;
    }
    if (err.message) return err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Erro desconhecido';
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({ baseURL: API_URL });

    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('access_token');
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });

    this.client.interceptors.response.use(
      (res) => res,
      (err: AxiosError) => {
        if (err.response?.status === 401) {
          localStorage.removeItem('access_token');
          window.location.hash = '#/login';
        }
        return Promise.reject(err);
      },
    );
  }

  // Auth
  async register(name: string, email: string, password: string) {
    const { data } = await this.client.post('/auth/register', { name, email, password });
    return data;
  }

  async requestToken(email: string) {
    const { data } = await this.client.post('/auth/request-token', { email });
    return data;
  }

  async login(email: string, token: string) {
    const { data } = await this.client.post('/auth/login', { email, token });
    localStorage.setItem('access_token', data.access_token);
    return data;
  }

  async loginWithPassword(email: string, password: string) {
    const { data } = await this.client.post('/auth/login-password', { email, password });
    localStorage.setItem('access_token', data.access_token);
    return data;
  }

  // Bots
  async getBots() {
    const { data } = await this.client.get('/bots');
    return data;
  }

  async getBot(botId: string) {
    const { data } = await this.client.get(`/bots/${botId}`);
    return data;
  }

  async createBot(payload: { name: string; responseMode?: string; initialMessage?: string; systemPrompt?: string; aiConfigId?: string | null; flowConfig?: FlowConfig }) {
    const { data } = await this.client.post('/bots', payload);
    return data;
  }

  async updateBot(botId: string, payload: Record<string, unknown>) {
    const { data } = await this.client.put(`/bots/${botId}`, payload);
    return data;
  }

  async deleteBot(botId: string) {
    const { data } = await this.client.delete(`/bots/${botId}`);
    return data;
  }

  // Keywords
  async getKeywords(botId: string): Promise<Keyword[]> {
    const { data } = await this.client.get(`/bots/${botId}/keywords`);
    return data;
  }

  async createKeyword(botId: string, payload: { trigger: string; response: string; priority?: number; goto?: GotoTarget }) {
    const { data } = await this.client.post(`/bots/${botId}/keywords`, payload);
    return data;
  }

  async updateKeyword(botId: string, keywordId: string, payload: Record<string, unknown>) {
    const { data } = await this.client.put(`/bots/${botId}/keywords/${keywordId}`, payload);
    return data;
  }

  async deleteKeyword(botId: string, keywordId: string) {
    const { data } = await this.client.delete(`/bots/${botId}/keywords/${keywordId}`);
    return data;
  }

  // Interactive Menus
  async getMenus(botId: string): Promise<InteractiveMenu[]> {
    const { data } = await this.client.get(`/bots/${botId}/menus`);
    return data;
  }

  async createMenu(botId: string, payload: { trigger: string; title: string; body?: string; footer?: string; options: MenuOption[] }) {
    const { data } = await this.client.post(`/bots/${botId}/menus`, payload);
    return data;
  }

  async updateMenu(botId: string, menuId: string, payload: Record<string, unknown>) {
    const { data } = await this.client.put(`/bots/${botId}/menus/${menuId}`, payload);
    return data;
  }

  async deleteMenu(botId: string, menuId: string) {
    const { data } = await this.client.delete(`/bots/${botId}/menus/${menuId}`);
    return data;
  }

  // WhatsApp Channel
  async getWhatsappChannel(botId: string) {
    const bot = await this.getBot(botId);
    return bot.whatsappChannel;
  }

  async createWhatsappChannel(botId: string, payload: {
    phoneNumber: string;
    provider?: 'DIALOG360' | 'EVOLUTION';
    dialog360ApiKey?: string;
    evolutionApiUrl?: string;
    evolutionApiKey?: string;
    evolutionInstance?: string;
  }) {
    const { data } = await this.client.post(`/bots/${botId}/whatsapp`, payload);
    return data;
  }

  async updateWhatsappChannel(botId: string, payload: Record<string, unknown>) {
    const { data } = await this.client.put(`/bots/${botId}/whatsapp`, payload);
    return data;
  }

  async deleteWhatsappChannel(botId: string) {
    const { data } = await this.client.delete(`/bots/${botId}/whatsapp`);
    return data;
  }

  async getEvolutionQrCode(botId: string) {
    const { data } = await this.client.get(`/bots/${botId}/whatsapp/evolution/qrcode`);
    return data;
  }

  async getEvolutionConnectionState(botId: string) {
    const { data } = await this.client.get(`/bots/${botId}/whatsapp/evolution/status`);
    return data;
  }

  // Dashboard & Analytics
  async getDashboardOverview(): Promise<DashboardOverview> {
    const { data } = await this.client.get('/bots/dashboard/overview');
    return data;
  }

  async getReportsAnalytics(): Promise<ReportsAnalytics> {
    const { data } = await this.client.get('/bots/reports/analytics');
    return data;
  }

  async getMonthlyMetrics(): Promise<MonthlyMetric[]> {
    const { data } = await this.client.get('/bots/reports/monthly');
    return data;
  }

  // Conversations
  async getConversations(botId: string) {
    const { data } = await this.client.get(`/bots/${botId}/conversations`);
    return data;
  }

  async getMessages(botId: string, conversationId: string, take = 50) {
    const { data } = await this.client.get(
      `/bots/${botId}/conversations/${conversationId}/messages?take=${take}`,
    );
    return data;
  }

  // Chat Management
  async getChats(filters?: { botId?: string; minWaitMinutes?: number; status?: string }) {
    const params = new URLSearchParams();
    if (filters?.botId) params.set('botId', filters.botId);
    if (filters?.minWaitMinutes) params.set('minWaitMinutes', String(filters.minWaitMinutes));
    if (filters?.status) params.set('status', filters.status);
    const { data } = await this.client.get(`/chats?${params.toString()}`);
    return data;
  }

  async getChatMessages(conversationId: string, take = 100) {
    const { data } = await this.client.get(`/chats/${conversationId}/messages?take=${take}`);
    return data;
  }

  async takeoverChat(conversationId: string) {
    const { data } = await this.client.post(`/chats/${conversationId}/takeover`);
    return data;
  }

  async releaseChat(conversationId: string) {
    const { data } = await this.client.post(`/chats/${conversationId}/release`);
    return data;
  }

  async sendChatMessage(conversationId: string, content: string) {
    const { data } = await this.client.post(`/chats/${conversationId}/send`, { content });
    return data;
  }

  // AI Configs
  async getAiConfigs() {
    const { data } = await this.client.get('/ai-configs');
    return data;
  }

  async getAiConfig(id: string) {
    const { data } = await this.client.get(`/ai-configs/${id}`);
    return data;
  }

  async createAiConfig(payload: {
    provider: string;
    name: string;
    apiKey: string;
    model: string;
    maxTokens?: number;
    temperature?: number;
    isDefault?: boolean;
  }) {
    const { data } = await this.client.post('/ai-configs', payload);
    return data;
  }

  async updateAiConfig(id: string, payload: Record<string, unknown>) {
    const { data } = await this.client.put(`/ai-configs/${id}`, payload);
    return data;
  }

  async deleteAiConfig(id: string) {
    const { data } = await this.client.delete(`/ai-configs/${id}`);
    return data;
  }

  logout() {
    localStorage.removeItem('access_token');
  }

  // ── Contacts ────────────────────────────────────────────────────────────

  async getContacts(botId: string, search?: string) {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    const { data } = await this.client.get(`/bots/${botId}/contacts${params}`);
    return data;
  }

  async getContact(botId: string, id: string) {
    const { data } = await this.client.get(`/bots/${botId}/contacts/${id}`);
    return data;
  }

  async createContact(botId: string, payload: {
    phone: string;
    name?: string;
    email?: string;
    tags?: string[];
    notes?: string;
    customFields?: Record<string, unknown>;
  }) {
    const { data } = await this.client.post(`/bots/${botId}/contacts`, payload);
    return data;
  }

  async updateContact(botId: string, id: string, payload: Record<string, unknown>) {
    const { data } = await this.client.put(`/bots/${botId}/contacts/${id}`, payload);
    return data;
  }

  async deleteContact(botId: string, id: string) {
    const { data } = await this.client.delete(`/bots/${botId}/contacts/${id}`);
    return data;
  }

  // ── Scheduled Messages ────────────────────────────────────────────────────

  async getScheduledMessages(botId: string, status?: string) {
    const params = status ? `?status=${status}` : '';
    const { data } = await this.client.get(`/bots/${botId}/scheduled-messages${params}`);
    return data;
  }

  async createScheduledMessage(botId: string, payload: {
    phone: string;
    message: string;
    scheduledAt: string;
    contactId?: string;
  }) {
    const { data } = await this.client.post(`/bots/${botId}/scheduled-messages`, payload);
    return data;
  }

  async cancelScheduledMessage(botId: string, id: string) {
    const { data } = await this.client.post(`/bots/${botId}/scheduled-messages/${id}/cancel`);
    return data;
  }

  async deleteScheduledMessage(botId: string, id: string) {
    const { data } = await this.client.delete(`/bots/${botId}/scheduled-messages/${id}`);
    return data;
  }

  // ── Broadcast Lists ────────────────────────────────────────────────────────

  async getBroadcastLists(botId: string) {
    const { data } = await this.client.get(`/bots/${botId}/broadcast-lists`);
    return data;
  }

  async createBroadcastList(botId: string, payload: { name: string; phones?: string[] }) {
    const { data } = await this.client.post(`/bots/${botId}/broadcast-lists`, payload);
    return data;
  }

  async updateBroadcastList(botId: string, id: string, payload: { name?: string; phones?: string[] }) {
    const { data } = await this.client.put(`/bots/${botId}/broadcast-lists/${id}`, payload);
    return data;
  }

  async deleteBroadcastList(botId: string, id: string) {
    const { data } = await this.client.delete(`/bots/${botId}/broadcast-lists/${id}`);
    return data;
  }

  // ── Broadcasts ────────────────────────────────────────────────────────────

  async getBroadcasts(botId: string) {
    const { data } = await this.client.get(`/bots/${botId}/broadcasts`);
    return data;
  }

  async createBroadcast(botId: string, payload: {
    name: string;
    message: string;
    listId?: string;
    phones?: string[];
    scheduledAt?: string;
  }) {
    const { data } = await this.client.post(`/bots/${botId}/broadcasts`, payload);
    return data;
  }

  async sendBroadcastNow(botId: string, id: string) {
    const { data } = await this.client.post(`/bots/${botId}/broadcasts/${id}/send`);
    return data;
  }

  async cancelBroadcast(botId: string, id: string) {
    const { data } = await this.client.post(`/bots/${botId}/broadcasts/${id}/cancel`);
    return data;
  }

  async deleteBroadcast(botId: string, id: string) {
    const { data } = await this.client.delete(`/bots/${botId}/broadcasts/${id}`);
    return data;
  }
}

export const api = new ApiService();
