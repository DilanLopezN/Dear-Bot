import { create } from 'zustand';
import { api, type FlowConfig } from '@/services/api';

export interface Bot {
  id: string;
  name: string;
  responseMode: 'KEYWORDS' | 'AI' | 'HYBRID';
  isActive: boolean;
  systemPrompt?: string;
  initialMessage?: string;
  aiConfigId?: string | null;
  aiConfig?: {
    id: string;
    provider: string;
    name: string;
    model: string;
  } | null;
  flowConfig?: FlowConfig | null;
  createdAt: string;
  whatsappChannel?: {
    id: string;
    phoneNumber: string;
    isVerified: boolean;
  } | null;
  _count?: {
    keywords: number;
    conversations: number;
  };
}

interface BotState {
  bots: Bot[];
  selectedBot: Bot | null;
  loading: boolean;
  fetchBots: () => Promise<void>;
  selectBot: (bot: Bot | null) => void;
  createBot: (payload: { name: string; responseMode?: string; initialMessage?: string; systemPrompt?: string; aiConfigId?: string | null; flowConfig?: FlowConfig }) => Promise<Bot>;
  updateBot: (botId: string, payload: Record<string, unknown>) => Promise<void>;
  deleteBot: (botId: string) => Promise<void>;
}

export const useBotStore = create<BotState>((set, get) => ({
  bots: [],
  selectedBot: null,
  loading: false,

  fetchBots: async () => {
    set({ loading: true });
    try {
      const bots = await api.getBots();
      set({ bots, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  selectBot: (bot) => set({ selectedBot: bot }),

  createBot: async (payload) => {
    const bot = await api.createBot(payload);
    await get().fetchBots();
    return bot;
  },

  updateBot: async (botId, payload) => {
    await api.updateBot(botId, payload);
    await get().fetchBots();
  },

  deleteBot: async (botId) => {
    await api.deleteBot(botId);
    set({ selectedBot: null });
    await get().fetchBots();
  },
}));
