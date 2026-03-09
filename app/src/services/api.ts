import axios, { AxiosInstance } from 'axios';

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
  async login(email: string, token: string) {
    // Login via email + token recebido por email
    const { data } = await this.client.post('/auth/login', { email, password: token });
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

  async createBot(payload: { name: string; responseMode?: string; systemPrompt?: string }) {
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

  logout() {
    localStorage.removeItem('access_token');
  }
}

export const api = new ApiService();
