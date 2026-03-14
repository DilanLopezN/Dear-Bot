import { type LucideIcon } from 'lucide-react';
import './StatCard.css';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  color?: string;
}

export default function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  color = 'var(--color-accent)',
}: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-card__content">
        <p className="stat-card__label">{label}</p>
        <p className="stat-card__value">{value}</p>
        {trend && (
          <span className={`stat-card__trend ${trend.positive ? 'stat-card__trend--positive' : 'stat-card__trend--negative'}`}>
            {trend.positive ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>
      <div
        className="stat-card__icon-wrapper"
        style={{ background: `${color}18` }}
      >
        <Icon size={20} style={{ color }} />
      </div>
    </div>
  );
}
