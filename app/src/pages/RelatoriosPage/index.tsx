import { useEffect, useState } from 'react';
import { api, type ReportsAnalytics, type MonthlyMetric } from '@/services/api';
import { BarChart3, MessageSquare, Users, TrendingUp, Loader2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from 'recharts';
import './RelatoriosPage.css';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4'];

const tooltipStyle = {
  contentStyle: {
    background: 'var(--color-bg-tertiary)',
    border: '1.5px solid var(--color-border)',
    borderRadius: 12,
    fontSize: 12,
    boxShadow: '0 8px 32px var(--color-shadow)',
  },
  labelStyle: { color: 'var(--color-text-secondary)' },
};

export default function RelatoriosPage() {
  const [analytics, setAnalytics] = useState<ReportsAnalytics | null>(null);
  const [monthly, setMonthly] = useState<MonthlyMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [a, m] = await Promise.all([api.getReportsAnalytics(), api.getMonthlyMetrics()]);
        setAnalytics(a);
        setMonthly(m);
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const totals = analytics?.totals || { totalBots: 0, totalConversas: 0, totalMensagens: 0, mediaMsgPorBot: 0 };

  const stats = [
    { label: 'Total Bots', value: totals.totalBots, icon: BarChart3, color: 'var(--color-accent)' },
    { label: 'Total Conversas', value: totals.totalConversas, icon: Users, color: '#22c55e' },
    { label: 'Total Mensagens', value: totals.totalMensagens, icon: MessageSquare, color: '#f59e0b' },
    { label: 'Média msg/bot', value: totals.mediaMsgPorBot, icon: TrendingUp, color: '#06b6d4' },
  ];

  return (
    <div className="page-container relatorios">
      <div className="page-header">
        <div className="page-header__info">
          <h1 className="page-header__title">Relatórios</h1>
          <p className="page-header__subtitle">Análise de desempenho dos bots</p>
        </div>
      </div>

      <div className="grid-stats">
        {stats.map((s) => (
          <div key={s.label} className="relatorios__stat-card">
            <div className="relatorios__stat-header">
              <p className="relatorios__stat-label">{s.label}</p>
              <s.icon size={16} style={{ color: s.color }} />
            </div>
            <p className="relatorios__stat-value">{s.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="loader" style={{ padding: '60px 0' }}>
          <Loader2 size={18} className="animate-spin" /> Carregando relatórios...
        </div>
      ) : (
        <>
          {monthly.length > 0 && (
            <div className="chart-card">
              <h3 className="chart-card__title">Tendência mensal (30 dias)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={monthly}>
                  <defs>
                    <linearGradient id="gradInbound" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradOutbound" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} width={32} />
                  <Tooltip {...tooltipStyle} />
                  <Legend verticalAlign="top" height={36} />
                  <Area type="monotone" dataKey="inbound" name="Recebidas" stroke="#6366f1" fill="url(#gradInbound)" strokeWidth={2} />
                  <Area type="monotone" dataKey="outbound" name="Enviadas" stroke="#22c55e" fill="url(#gradOutbound)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid-charts">
            <div className="chart-card">
              <h3 className="chart-card__title">Mensagens por Bot</h3>
              {(analytics?.botStats?.length || 0) === 0 ? (
                <p style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-muted)', fontSize: 14 }}>Sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={analytics?.botStats}>
                    <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} width={32} />
                    <Tooltip {...tooltipStyle} />
                    <Legend verticalAlign="top" height={36} />
                    <Bar dataKey="mensagens" name="Mensagens" fill="#6366f1" radius={[5, 5, 0, 0]} />
                    <Bar dataKey="conversas" name="Conversas" fill="#22c55e" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="chart-card">
              <h3 className="chart-card__title">Distribuição por Modo</h3>
              {(analytics?.modeDistribution?.length || 0) === 0 ? (
                <p style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-muted)', fontSize: 14 }}>Sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={analytics?.modeDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={false}
                    >
                      {(analytics?.modeDistribution || []).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
