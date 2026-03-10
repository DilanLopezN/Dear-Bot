import axios, { AxiosInstance } from 'axios';

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

export interface FlowStep {
  type: 'GOTO_MENU';
  menuTrigger: string;
}

export interface FlowConfig {
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
      (err) => {
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
  async getKeywords(botId: string) {
    const { data } = await this.client.get(`/bots/${botId}/keywords`);
    return data;
  }

  async createKeyword(botId: string, payload: { trigger: string; response: string; priority?: number }) {
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

  async createWhatsappChannel(botId: string, payload: { phoneNumber: string; dialog360ApiKey: string }) {
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
}

export const api = new ApiService();
