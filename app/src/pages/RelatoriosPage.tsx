import { useEffect, useState } from 'react';
import { api, type ReportsAnalytics, type MonthlyMetric } from '@/services/api';
import {
  BarChart3, MessageSquare, Users, TrendingUp, Loader2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from 'recharts';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4'];

export default function RelatoriosPage() {
  const [analytics, setAnalytics] = useState<ReportsAnalytics | null>(null);
  const [monthly, setMonthly] = useState<MonthlyMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [a, m] = await Promise.all([
          api.getReportsAnalytics(),
          api.getMonthlyMetrics(),
        ]);
        setAnalytics(a);
        setMonthly(m);
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const totals = analytics?.totals || { totalBots: 0, totalConversas: 0, totalMensagens: 0, mediaMsgPorBot: 0 };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>Relatórios</h1>
        <p className="text-base text-[var(--color-text-secondary)] mt-2">Análise de desempenho dos bots</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: 'Total Bots', value: totals.totalBots, icon: BarChart3, color: 'var(--color-accent)' },
          { label: 'Total Conversas', value: totals.totalConversas, icon: Users, color: '#22c55e' },
          { label: 'Total Mensagens', value: totals.totalMensagens, icon: MessageSquare, color: '#f59e0b' },
          { label: 'Média msg/bot', value: totals.mediaMsgPorBot, icon: TrendingUp, color: '#06b6d4' },
        ].map((s) => (
          <div key={s.label} className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">{s.label}</p>
              <s.icon className="w-4 h-4" style={{ color: s.color }} />
            </div>
            <p className="text-2xl font-bold text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-[var(--color-text-muted)]">
          <Loader2 className="w-5 h-5 animate-spin mr-3" /> Carregando relatórios...
        </div>
      ) : (
        <>
          {/* Monthly trend chart */}
          {monthly.length > 0 && (
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-6 pb-4">
              <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-5 uppercase tracking-wider">Tendência mensal (30 dias)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={monthly}>
                  <defs>
                    <linearGradient id="gradInbound" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradOutbound" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} width={36} />
                  <Tooltip contentStyle={{ background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 12, fontSize: 12, boxShadow: '0 8px 32px var(--color-shadow)' }} labelStyle={{ color: 'var(--color-text-secondary)' }} />
                  <Legend verticalAlign="top" height={36} />
                  <Area type="monotone" dataKey="inbound" name="Recebidas" stroke="#6366f1" fill="url(#gradInbound)" strokeWidth={2} />
                  <Area type="monotone" dataKey="outbound" name="Enviadas" stroke="#22c55e" fill="url(#gradOutbound)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Mensagens por Bot */}
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-6 pb-4">
              <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-5 uppercase tracking-wider">Mensagens por Bot</h3>
              {(analytics?.botStats?.length || 0) === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)] text-center py-16">Sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={analytics?.botStats}>
                    <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} width={36} />
                    <Tooltip contentStyle={{ background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 12, fontSize: 12, boxShadow: '0 8px 32px var(--color-shadow)' }} />
                    <Legend verticalAlign="top" height={36} />
                    <Bar dataKey="mensagens" name="Mensagens" fill="#6366f1" radius={[5, 5, 0, 0]} />
                    <Bar dataKey="conversas" name="Conversas" fill="#22c55e" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Distribuição por modo */}
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-6 pb-4">
              <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-5 uppercase tracking-wider">Distribuição por Modo</h3>
              {(analytics?.modeDistribution?.length || 0) === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)] text-center py-16">Sem dados</p>
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
                    <Tooltip contentStyle={{ background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 12, fontSize: 12, boxShadow: '0 8px 32px var(--color-shadow)' }} />
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
