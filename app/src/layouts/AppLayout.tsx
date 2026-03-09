import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';

export default function AppLayout() {
  return (
    <div className="flex h-screen bg-[var(--color-bg-primary)]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
