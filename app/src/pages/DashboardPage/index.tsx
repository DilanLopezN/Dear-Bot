import { useEffect, useState } from 'react';
import { useBotStore, type Bot } from '@/stores/bot.store';
import { api, type DashboardOverview } from '@/services/api';
import StatCard from '@/components/StatCard';
import { Bot as BotIcon, MessageSquare, Users, Zap, Activity, Loader2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import './DashboardPage.css';

const emptyOverview: DashboardOverview = {
  totals: { totalBots: 0, activeBots: 0, connectedBots: 0, totalConversations: 0, totalMessages: 0 },
  dailyMetrics: [],
  recentBots: [],
};

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
    <div className="page-container dashboard">
      <div className="page-header">
        <div className="page-header__info">
          <h1 className="page-header__title">Dashboard</h1>
          <p className="page-header__subtitle">Visão geral dos seus chatbots</p>
        </div>
      </div>

      <div className="grid-stats">
        <StatCard label="Bots Ativos" value={overview.totals.activeBots} icon={BotIcon} trend={{ value: `${overview.totals.totalBots} total`, positive: true }} />
        <StatCard label="Conversas" value={overview.totals.totalConversations} icon={Users} color="#22c55e" />
        <StatCard label="Mensagens" value={overview.totals.totalMessages} icon={MessageSquare} color="#f59e0b" />
        <StatCard label="WhatsApp" value={overview.totals.connectedBots} icon={Zap} color="#06b6d4" trend={{ value: 'conectados', positive: true }} />
      </div>

      <div className="grid-charts">
        <div className="chart-card">
          <h3 className="chart-card__title">Mensagens por dia</h3>
          {loadingData ? (
            <div className="dashboard__loader-chart">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={overview.dailyMetrics}>
                <defs>
                  <linearGradient id="gradientMsg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} width={32} />
                <Tooltip {...tooltipStyle} />
                <Area type="monotone" dataKey="mensagens" stroke="#22c55e" fill="url(#gradientMsg)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="chart-card">
          <h3 className="chart-card__title">Conversas por dia</h3>
          {loadingData ? (
            <div className="dashboard__loader-chart">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={overview.dailyMetrics}>
                <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} width={32} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="conversas" fill="#22c55e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="chart-card">
        <h3 className="chart-card__title">
          <Activity size={14} /> Bots Recentes
        </h3>
        {loading ? (
          <div className="loader" style={{ height: 96 }}>
            <Loader2 size={18} className="animate-spin" /> Carregando...
          </div>
        ) : overview.recentBots.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--color-text-muted)', textAlign: 'center', padding: '32px 0' }}>
            Nenhum bot criado ainda.
          </p>
        ) : (
          <div className="dashboard__bots-list">
            {overview.recentBots.map((bot: Bot) => (
              <div key={bot.id} className="dashboard__bot-row">
                <div className="dashboard__bot-info">
                  <span className={`dashboard__bot-dot ${bot.isActive ? 'dashboard__bot-dot--active' : 'dashboard__bot-dot--inactive'}`} />
                  <span className="dashboard__bot-name">{bot.name}</span>
                  <span className="badge badge-accent">{bot.responseMode}</span>
                </div>
                <div className="dashboard__bot-meta">
                  <span>{bot._count?.conversations || 0} conversas</span>
                  <span>{bot._count?.keywords || 0} keywords</span>
                  {bot.whatsappChannel && <Zap size={13} color="#4ade80" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
