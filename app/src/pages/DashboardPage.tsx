import { useEffect, useState } from 'react';
import { useBotStore, type Bot } from '@/stores/bot.store';
import { api, type DashboardOverview } from '@/services/api';
import StatCard from '@/components/StatCard';
import { Bot as BotIcon, MessageSquare, Users, Zap, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useTheme } from '@/ThemeContext';

const emptyOverview: DashboardOverview = { totals: { totalBots: 0, activeBots: 0, connectedBots: 0, totalConversations: 0, totalMessages: 0 }, dailyMetrics: [], recentBots: [] };

export default function DashboardPage() {
  const { fetchBots, loading } = useBotStore();
  const [overview, setOverview] = useState<DashboardOverview>(emptyOverview);
  const { theme } = useTheme();

  useEffect(() => {
    fetchBots();
    api.getDashboardOverview().then(setOverview).catch(() => setOverview(emptyOverview));
  }, [fetchBots]);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div><h1 style={{ color: theme.textPrimary }}>Dashboard</h1><p style={{ color: theme.textSecondary }}>Visão geral dos seus chatbots</p></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
        <StatCard label="Bots Ativos" value={overview.totals.activeBots} icon={BotIcon} trend={{ value: `${overview.totals.totalBots} total`, positive: true }} />
        <StatCard label="Conversas" value={overview.totals.totalConversations} icon={Users} color="#22c55e" />
        <StatCard label="Mensagens" value={overview.totals.totalMessages} icon={MessageSquare} color="#f59e0b" />
        <StatCard label="WhatsApp" value={overview.totals.connectedBots} icon={Zap} color="#06b6d4" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 20 }}><h3 style={{ color: theme.textSecondary }}>Mensagens por dia</h3><ResponsiveContainer width="100%" height={260}><AreaChart data={overview.dailyMetrics}><XAxis dataKey="name" stroke={theme.textSecondary} /><YAxis stroke={theme.textSecondary} /><Tooltip /><Area type="monotone" dataKey="mensagens" stroke={theme.accent} fill={`${theme.accent}33`} /></AreaChart></ResponsiveContainer></div>
        <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 20 }}><h3 style={{ color: theme.textSecondary }}>Conversas por dia</h3><ResponsiveContainer width="100%" height={260}><BarChart data={overview.dailyMetrics}><XAxis dataKey="name" stroke={theme.textSecondary} /><YAxis stroke={theme.textSecondary} /><Tooltip /><Bar dataKey="conversas" fill={theme.accent} /></BarChart></ResponsiveContainer></div>
      </div>
      <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 20 }}>
        <h3 style={{ color: theme.textSecondary, display: 'flex', gap: 8, alignItems: 'center' }}><Activity size={16} /> Bots Recentes</h3>
        {loading ? <p>Carregando...</p> : overview.recentBots.map((bot: Bot) => (
          <div key={bot.id} style={{ padding: 14, marginTop: 10, borderRadius: 12, background: theme.bgSecondary, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: theme.textPrimary }}>{bot.name}</span>
            <span style={{ color: theme.textSecondary }}>{bot._count?.conversations || 0} conversas</span>
          </div>
        ))}
      </div>
    </div>
  );
}
