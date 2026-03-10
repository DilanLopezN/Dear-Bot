import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { themes, type ThemeMode } from './theme';

type ThemeContextType = {
  mode: ThemeMode;
  theme: (typeof themes)[ThemeMode];
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>((localStorage.getItem('theme_mode') as ThemeMode) || 'dark');

  const value = useMemo(
    () => ({
      mode,
      theme: themes[mode],
      toggleTheme: () => {
        setMode((prev) => {
          const next = prev === 'dark' ? 'light' : 'dark';
          localStorage.setItem('theme_mode', next);
          return next;
        });
      },
    }),
    [mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
