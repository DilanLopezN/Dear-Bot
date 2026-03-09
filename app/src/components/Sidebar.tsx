import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import {
  LayoutDashboard,
  Bot,
  BarChart3,
  CreditCard,
  LogOut,
  MessageSquare,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/bots', icon: Bot, label: 'Bots' },
  { to: '/relatorios', icon: BarChart3, label: 'Relatórios' },
  { to: '/financeiro', icon: CreditCard, label: 'Financeiro' },
];

export default function Sidebar() {
  const { logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="w-[240px] h-screen flex flex-col bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] shrink-0">
      {/* Logo */}
      <div className="h-[60px] flex items-center gap-2.5 px-5 border-b border-[var(--color-border)] drag-region">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)] flex items-center justify-center no-drag">
          <MessageSquare className="w-4 h-4 text-white" />
        </div>
        <span className="text-base font-bold tracking-tight text-[var(--color-text-primary)] no-drag" style={{ fontFamily: 'var(--font-display)' }}>
          Chatbot SaaS
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 flex flex-col gap-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[var(--color-accent-glow)] text-[var(--color-accent-hover)] border border-[var(--color-accent)]/20'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
              }`
            }
          >
            <Icon className="w-[18px] h-[18px]" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-[var(--color-border)]">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--color-text-secondary)] hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
        >
          <LogOut className="w-[18px] h-[18px]" />
          Sair
        </button>
      </div>
    </aside>
  );
}
