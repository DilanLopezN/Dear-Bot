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
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-7 flex items-start justify-between hover:border-[var(--color-border-light)] transition-colors">
      <div>
        <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">{label}</p>
        <p className="text-3xl font-bold text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>{value}</p>
        {trend && (
          <span className={`text-sm font-medium mt-3 inline-block ${trend.positive ? 'text-green-400' : 'text-red-400'}`}>
            {trend.positive ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `${color}15` }}>
        <Icon className="w-6 h-6" style={{ color }} />
      </div>
    </div>
  );
}
