import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';
import AppLayout from '@/layouts/AppLayout';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import DashboardPage from '@/pages/DashboardPage';
import BotsPage from '@/pages/BotsPage';
import RelatoriosPage from '@/pages/RelatoriosPage';
import FinanceiroPage from '@/pages/FinanceiroPage';
import AiConfigPage from '@/pages/AiConfigPage';
import ChatPage from '@/pages/ChatPage';
import ContactsPage from '@/pages/ContactsPage';
import ScheduledMessagesPage from '@/pages/ScheduledMessagesPage';
import BroadcastPage from '@/pages/BroadcastPage';
import LeadsPage from '@/pages/LeadsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <>
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          style: {
            fontFamily: 'var(--font-body)',
          },
        }}
      />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/bots" element={<BotsPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/scheduled-messages" element={<ScheduledMessagesPage />} />
          <Route path="/broadcast" element={<BroadcastPage />} />
          <Route path="/relatorios" element={<RelatoriosPage />} />
          <Route path="/financeiro" element={<FinanceiroPage />} />
          <Route path="/ai-config" element={<AiConfigPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
