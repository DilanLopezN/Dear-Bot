import { useEffect, useState } from 'react';
import { useBotStore, type Bot } from '@/stores/bot.store';
import { api, type DashboardOverview } from '@/services/api';
import StatCard from '@/components/StatCard';
import { Bot as BotIcon, MessageSquare, Users, Zap, Activity, Loader2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const emptyOverview: DashboardOverview = {
  totals: {
    totalBots: 0,
    activeBots: 0,
    connectedBots: 0,
    totalConversations: 0,
    totalMessages: 0,
  },
  dailyMetrics: [],
  recentBots: [],
};

export default function DashboardPage() {
  const { fetchBots, loading } = useBotStore();
  const [overview, setOverview] = useState<DashboardOverview>(emptyOverview);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    fetchBots();
    api.getDashboardOverview()
      .then(setOverview)
      .catch(() => setOverview(emptyOverview))
      .finally(() => setLoadingData(false));
  }, [fetchBots]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>
          Dashboard
        </h1>
        <p className="text-base text-[var(--color-text-secondary)] mt-2">
          Visão geral dos seus chatbots
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard label="Bots Ativos" value={overview.totals.activeBots} icon={BotIcon} trend={{ value: `${overview.totals.totalBots} total`, positive: true }} />
        <StatCard label="Conversas" value={overview.totals.totalConversations} icon={Users} color="#22c55e" />
        <StatCard label="Mensagens" value={overview.totals.totalMessages} icon={MessageSquare} color="#f59e0b" />
        <StatCard label="WhatsApp" value={overview.totals.connectedBots} icon={Zap} color="#06b6d4" trend={{ value: 'conectados', positive: true }} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-6 pb-4">
          <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-5 uppercase tracking-wider">Mensagens por dia</h3>
          {loadingData ? (
            <div className="flex items-center justify-center h-[260px] text-[var(--color-text-muted)]">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={overview.dailyMetrics}>
                <defs>
                  <linearGradient id="gradientMsg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} width={36} />
                <Tooltip contentStyle={{ background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 12, fontSize: 13, boxShadow: '0 8px 32px var(--color-shadow)' }} labelStyle={{ color: 'var(--color-text-secondary)' }} />
                <Area type="monotone" dataKey="mensagens" stroke="#22c55e" fill="url(#gradientMsg)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-6 pb-4">
          <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-5 uppercase tracking-wider">Conversas por dia</h3>
          {loadingData ? (
            <div className="flex items-center justify-center h-[260px] text-[var(--color-text-muted)]">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={overview.dailyMetrics}>
                <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} width={36} />
                <Tooltip contentStyle={{ background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 12, fontSize: 13, boxShadow: '0 8px 32px var(--color-shadow)' }} labelStyle={{ color: 'var(--color-text-secondary)' }} />
                <Bar dataKey="conversas" fill="#22c55e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent Bots */}
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-5 flex items-center gap-2.5 uppercase tracking-wider">
          <Activity className="w-4 h-4" /> Bots Recentes
        </h3>
        {loading ? (
          <div className="flex items-center justify-center h-24 text-[var(--color-text-muted)]">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
          </div>
        ) : overview.recentBots.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] py-8 text-center">Nenhum bot criado ainda.</p>
        ) : (
          <div className="space-y-3">
            {overview.recentBots.map((bot: Bot) => (
              <div key={bot.id} className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] transition-colors">
                <div className="flex items-center gap-3.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${bot.isActive ? 'bg-green-400' : 'bg-[var(--color-text-muted)]'}`} />
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">{bot.name}</span>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-accent-glow)] text-[var(--color-accent)] font-medium">{bot.responseMode}</span>
                </div>
                <div className="flex items-center gap-5 text-xs text-[var(--color-text-muted)]">
                  <span>{bot._count?.conversations || 0} conversas</span>
                  <span>{bot._count?.keywords || 0} keywords</span>
                  {bot.whatsappChannel && <Zap className="w-3.5 h-3.5 text-green-400" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
