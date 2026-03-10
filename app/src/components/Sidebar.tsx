import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { LayoutDashboard, Bot, BarChart3, CreditCard, LogOut, MessageSquare, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/ThemeContext';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/bots', icon: Bot, label: 'Bots' },
  { to: '/relatorios', icon: BarChart3, label: 'Relatórios' },
  { to: '/financeiro', icon: CreditCard, label: 'Financeiro' },
];

export default function Sidebar() {
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const { theme, mode, toggleTheme } = useTheme();

  return (
    <aside style={{ width: 280, height: '100vh', display: 'flex', flexDirection: 'column', background: theme.bgSecondary, borderRight: `1px solid ${theme.border}` }}>
      <div className="drag-region" style={{ height: 74, display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', borderBottom: `1px solid ${theme.border}` }}>
        <div className="no-drag" style={{ width: 38, height: 38, borderRadius: 12, background: theme.accent, display: 'grid', placeItems: 'center' }}><MessageSquare size={18} color="#fff" /></div>
        <strong className="no-drag" style={{ color: theme.textPrimary, fontSize: 18 }}>Dear Bot</strong>
      </div>
      <nav style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'} style={({ isActive }) => ({
            color: isActive ? theme.accent : theme.textSecondary,
            background: isActive ? `${theme.accent}20` : 'transparent',
            textDecoration: 'none',
            border: `1px solid ${isActive ? `${theme.accent}40` : 'transparent'}`,
            borderRadius: 12,
            padding: '12px 14px',
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            fontWeight: 600,
          })}><Icon size={18} />{label}</NavLink>
        ))}
      </nav>
      <div style={{ padding: 16, borderTop: `1px solid ${theme.border}`, display: 'grid', gap: 10 }}>
        <button onClick={toggleTheme} style={{ height: 44, borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.bgCard, color: theme.textPrimary, cursor: 'pointer' }}>
          {mode === 'dark' ? <Sun size={16} /> : <Moon size={16} />} {mode === 'dark' ? 'Tema claro' : 'Tema escuro'}
        </button>
        <button onClick={() => { logout(); navigate('/login'); }} style={{ height: 44, borderRadius: 12, border: `1px solid ${theme.border}`, background: `${theme.danger}14`, color: theme.danger, cursor: 'pointer' }}>
          <LogOut size={16} /> Sair
        </button>
      </div>
    </aside>
  );
}
