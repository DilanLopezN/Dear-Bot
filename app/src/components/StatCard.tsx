import { type LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  color?: string;
}

export default function StatCard({ label, value, icon: Icon, trend, color = 'var(--color-accent)' }: StatCardProps) {
  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-5 flex items-start justify-between hover:border-[var(--color-border-light)] transition-colors">
      <div>
        <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1">{label}</p>
        <p className="text-2xl font-bold text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>{value}</p>
        {trend && (
          <span className={`text-xs font-medium mt-1 inline-block ${trend.positive ? 'text-green-400' : 'text-red-400'}`}>
            {trend.positive ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>
      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
    </div>
  );
}
