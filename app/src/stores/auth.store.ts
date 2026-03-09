import { create } from 'zustand';
import { api } from '@/services/api';

interface AuthState {
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  login: (email: string, token: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: !!localStorage.getItem('access_token'),
  loading: false,
  error: null,

  login: async (email, token) => {
    set({ loading: true, error: null });
    try {
      await api.login(email, token);
      set({ isAuthenticated: true, loading: false });
    } catch (err: any) {
      set({
        loading: false,
        error: err.response?.data?.message || 'Token inválido ou expirado',
      });
      throw err;
    }
  },

  logout: () => {
    api.logout();
    set({ isAuthenticated: false });
  },

  checkAuth: () => {
    set({ isAuthenticated: !!localStorage.getItem('access_token') });
  },
}));
