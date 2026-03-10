import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { useThemeStore } from '@/stores/theme.store';
import {
  LayoutDashboard,
  Bot,
  BarChart3,
  CreditCard,
  LogOut,
  MessageSquare,
  Sun,
  Moon,
  Cpu,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/bots', icon: Bot, label: 'Bots' },
  { to: '/ai-config', icon: Cpu, label: 'Configuração I.A.' },
  { to: '/relatorios', icon: BarChart3, label: 'Relatórios' },
  { to: '/financeiro', icon: CreditCard, label: 'Financeiro' },
];

export default function Sidebar() {
  const { logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="w-[280px] h-screen flex flex-col bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] shrink-0">
      <div className="h-[74px] flex items-center gap-3.5 px-7 border-b border-[var(--color-border)] drag-region">
        <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)] flex items-center justify-center no-drag">
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
        <span className="text-lg font-bold tracking-tight text-[var(--color-text-primary)] no-drag" style={{ fontFamily: 'var(--font-display)' }}>
          Dear Bot
        </span>
      </div>

      <nav className="flex-1 py-6 px-4 flex flex-col gap-1.5">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-[15px] font-medium transition-all ${
                isActive
                  ? 'bg-[var(--color-accent-glow)] text-[var(--color-accent)] border border-[var(--color-accent)]/20'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
              }`
            }
          >
            <Icon className="w-[20px] h-[20px]" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 pb-2">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-all cursor-pointer"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
        </button>
      </div>

      <div className="p-4 pt-0 border-t border-[var(--color-border)]">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-sm text-[var(--color-text-secondary)] hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer mt-2"
        >
          <LogOut className="w-5 h-5" />
          Sair
        </button>
      </div>
    </aside>
  );
}
