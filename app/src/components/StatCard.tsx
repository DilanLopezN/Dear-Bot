import { type LucideIcon } from 'lucide-react';
import { useTheme } from '@/ThemeContext';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  color?: string;
}

export default function StatCard({ label, value, icon: Icon, trend, color }: StatCardProps) {
  const { theme } = useTheme();
  const iconColor = color || theme.accent;
  return (
    <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 24, display: 'flex', justifyContent: 'space-between' }}>
      <div>
        <p style={{ margin: 0, fontSize: 12, color: theme.textSecondary, textTransform: 'uppercase' }}>{label}</p>
        <h3 style={{ margin: '12px 0 0', fontSize: 30, color: theme.textPrimary }}>{value}</h3>
        {trend ? <span style={{ display: 'block', marginTop: 10, color: trend.positive ? '#22c55e' : theme.danger, fontSize: 13 }}>{trend.value}</span> : null}
      </div>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: `${iconColor}22`, display: 'grid', placeItems: 'center' }}>
        <Icon size={24} color={iconColor} />
      </div>
    </div>
  );
}
