import { useTheme } from '@/ThemeContext';

export default function RelatoriosPage() {
  const { theme } = useTheme();
  return (
    <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 24 }}>
      <h1 style={{ color: theme.textPrimary }}>Relatórios</h1>
      <p style={{ color: theme.textSecondary }}>Página em revisão de design com novo sistema de componentes.</p>
    </div>
  );
}
