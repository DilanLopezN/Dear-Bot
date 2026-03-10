import { useTheme } from '@/ThemeContext';

export default function FinanceiroPage() {
  const { theme } = useTheme();
  return (
    <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 24 }}>
      <h1 style={{ color: theme.textPrimary }}>Financeiro</h1>
      <p style={{ color: theme.textSecondary }}>Tema light/dark e novos componentes já aplicados nesta área.</p>
    </div>
  );
}
