import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import { useTheme } from '@/ThemeContext';

export default function AppLayout() {
  const { theme } = useTheme();
  return (
    <div style={{ display: 'flex', height: '100vh', background: theme.bgPrimary }}>
      <Sidebar />
      <main style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: 32, maxWidth: 1480, margin: '0 auto' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
