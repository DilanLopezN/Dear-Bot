import { create } from 'zustand';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const getInitialTheme = (): Theme => {
  const saved = localStorage.getItem('theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return 'dark';
};

export const useThemeStore = create<ThemeState>((set, get) => {
  // Apply initial theme
  const initial = getInitialTheme();
  document.documentElement.setAttribute('data-theme', initial);

  return {
    theme: initial,

    toggleTheme: () => {
      const next = get().theme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      set({ theme: next });
    },

    setTheme: (theme) => {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
      set({ theme });
    },
  };
});
