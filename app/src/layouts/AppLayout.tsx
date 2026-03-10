import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import { useTheme } from '@/ThemeContext';

export default function AppLayout() {
  const { theme } = useTheme();
  return (
    <div style={{ display: 'flex', height: '100vh', background: theme.bgPrimary }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-10 max-w-[1480px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
