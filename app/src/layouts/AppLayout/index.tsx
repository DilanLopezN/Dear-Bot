import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import './AppLayout.css';

export default function AppLayout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-layout__main">
        <div className="app-layout__content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
