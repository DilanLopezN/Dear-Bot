import { create } from 'zustand';
import { api, type ChatConversation, type ChatMessage } from '@/services/api';

interface ChatFilters {
  botId?: string;
  minWaitMinutes?: number;
  status?: string;
}

interface ChatState {
  chats: ChatConversation[];
  selectedChat: ChatConversation | null;
  messages: ChatMessage[];
  filters: ChatFilters;
  loading: boolean;
  loadingMessages: boolean;

  setFilters: (filters: ChatFilters) => void;
  fetchChats: () => Promise<void>;
  selectChat: (chat: ChatConversation | null) => void;
  fetchMessages: (conversationId: string) => Promise<void>;
  takeover: (conversationId: string) => Promise<void>;
  release: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, content: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  selectedChat: null,
  messages: [],
  filters: {},
  loading: false,
  loadingMessages: false,

  setFilters: (filters) => {
    set({ filters });
    get().fetchChats();
  },

  fetchChats: async () => {
    set({ loading: true });
    try {
      const chats = await api.getChats(get().filters);
      set({ chats, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  selectChat: (chat) => {
    set({ selectedChat: chat, messages: [] });
    if (chat) get().fetchMessages(chat.id);
  },

  fetchMessages: async (conversationId) => {
    set({ loadingMessages: true });
    try {
      const messages = await api.getChatMessages(conversationId);
      set({ messages, loadingMessages: false });
    } catch {
      set({ loadingMessages: false });
    }
  },

  takeover: async (conversationId) => {
    const result = await api.takeoverChat(conversationId);
    const { selectedChat } = get();
    if (selectedChat && selectedChat.id === conversationId) {
      set({ selectedChat: { ...selectedChat, status: 'HUMAN', humanTakeoverAt: result.humanTakeoverAt } });
    }
    await get().fetchChats();
  },

  release: async (conversationId) => {
    await api.releaseChat(conversationId);
    const { selectedChat } = get();
    if (selectedChat && selectedChat.id === conversationId) {
      set({ selectedChat: { ...selectedChat, status: 'BOT', humanTakeoverAt: null } });
    }
    await get().fetchChats();
  },

  sendMessage: async (conversationId, content) => {
    const message = await api.sendChatMessage(conversationId, content);
    set((state) => ({ messages: [...state.messages, message] }));
  },
}));
