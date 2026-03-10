import { useEffect, useState } from 'react';
import { useBotStore, type Bot } from '@/stores/bot.store';
import { api, type DashboardOverview } from '@/services/api';
import StatCard from '@/components/StatCard';
import { Bot as BotIcon, MessageSquare, Users, Zap, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useTheme } from '@/ThemeContext';

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

  useEffect(() => {
    fetchBots();
    api.getDashboardOverview().then(setOverview).catch(() => setOverview(emptyOverview));
  }, [fetchBots]);

  return (
    <div className="space-y-9">
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>
          Dashboard
        </h1>
        <p className="text-base text-[var(--color-text-secondary)] mt-2">
          Visão geral dos seus chatbots
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Bots Ativos" value={overview.totals.activeBots} icon={BotIcon} trend={{ value: `${overview.totals.totalBots} total`, positive: true }} />
        <StatCard label="Conversas" value={overview.totals.totalConversations} icon={Users} color="#22c55e" />
        <StatCard label="Mensagens" value={overview.totals.totalMessages} icon={MessageSquare} color="#f59e0b" />
        <StatCard label="WhatsApp" value={overview.totals.connectedBots} icon={Zap} color="#06b6d4" trend={{ value: 'conectados', positive: true }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-7">
          <h3 className="text-base font-medium text-[var(--color-text-secondary)] mb-6">Mensagens por dia</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={overview.dailyMetrics}>
              <defs>
                <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 10, fontSize: 13 }} labelStyle={{ color: 'var(--color-text-secondary)' }} />
              <Area type="monotone" dataKey="mensagens" stroke="var(--color-accent)" fill="url(#gradient)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-7">
          <h3 className="text-base font-medium text-[var(--color-text-secondary)] mb-6">Conversas por dia</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={overview.dailyMetrics}>
              <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 10, fontSize: 13 }} labelStyle={{ color: 'var(--color-text-secondary)' }} />
              <Bar dataKey="conversas" fill="var(--color-accent)" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-7">
        <h3 className="text-base font-medium text-[var(--color-text-secondary)] mb-6 flex items-center gap-2">
          <Activity className="w-4 h-4" /> Bots Recentes
        </h3>
        {loading ? (
          <p className="text-sm text-[var(--color-text-muted)]">Carregando...</p>
        ) : overview.recentBots.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">Nenhum bot criado ainda.</p>
        ) : (
          <div className="space-y-4">
            {overview.recentBots.map((bot: Bot) => (
              <div key={bot.id} className="flex items-center justify-between p-5 rounded-2xl bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${bot.isActive ? 'bg-green-400' : 'bg-[var(--color-text-muted)]'}`} />
                  <span className="text-base font-medium text-[var(--color-text-primary)]">{bot.name}</span>
                  <span className="text-xs px-3 py-1.5 rounded-full bg-[var(--color-accent-glow)] text-[var(--color-accent)]">{bot.responseMode}</span>
                </div>
                <div className="flex items-center gap-6 text-sm text-[var(--color-text-muted)]">
                  <span>{bot._count?.conversations || 0} conversas</span>
                  <span>{bot._count?.keywords || 0} keywords</span>
                  {bot.whatsappChannel && <Zap className="w-4 h-4 text-green-400" />}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
