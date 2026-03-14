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
import './Sidebar.css';

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
    <aside className="sidebar">
      <div className="sidebar__logo drag-region">
        <div className="sidebar__logo-icon no-drag">
          <MessageSquare size={20} color="#fff" />
        </div>
        <span className="sidebar__logo-text no-drag">Dear Bot</span>
      </div>

      <nav className="sidebar__nav">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `sidebar__nav-item${isActive ? ' sidebar__nav-item--active' : ''}`
            }
          >
            <Icon className="sidebar__nav-icon" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__bottom">
        <button className="sidebar__action" onClick={toggleTheme}>
          {theme === 'dark'
            ? <Sun className="sidebar__action-icon" />
            : <Moon className="sidebar__action-icon" />}
          {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
        </button>
        <button className="sidebar__action sidebar__action--danger" onClick={handleLogout}>
          <LogOut className="sidebar__action-icon" />
          Sair
        </button>
      </div>
    </aside>
  );
}
