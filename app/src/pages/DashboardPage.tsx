import { useEffect, useState } from 'react';
import { useBotStore, type Bot } from '@/stores/bot.store';
import { api } from '@/services/api';
import StatCard from '@/components/StatCard';
import { Bot as BotIcon, MessageSquare, Users, Zap, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const mockChartData = [
  { name: 'Seg', mensagens: 45, conversas: 12 },
  { name: 'Ter', mensagens: 78, conversas: 23 },
  { name: 'Qua', mensagens: 62, conversas: 18 },
  { name: 'Qui', mensagens: 95, conversas: 31 },
  { name: 'Sex', mensagens: 110, conversas: 42 },
  { name: 'Sáb', mensagens: 43, conversas: 15 },
  { name: 'Dom', mensagens: 28, conversas: 8 },
];

export default function DashboardPage() {
  const { bots, fetchBots, loading } = useBotStore();
  const [stats, setStats] = useState({ totalConversations: 0, totalMessages: 0 });

  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  useEffect(() => {
    const loadStats = async () => {
      let conversations = 0;
      let messages = 0;
      for (const bot of bots) {
        try {
          const convs = await api.getConversations(bot.id);
          conversations += convs.length;
          messages += convs.reduce((acc: number, c: any) => acc + (c._count?.messages || 0), 0);
        } catch {}
      }
      setStats({ totalConversations: conversations, totalMessages: messages });
    };
    if (bots.length) loadStats();
  }, [bots]);

  const activeBots = bots.filter((b) => b.isActive).length;
  const connectedBots = bots.filter((b) => b.whatsappChannel).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>
          Dashboard
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Visão geral dos seus chatbots
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Bots Ativos" value={activeBots} icon={BotIcon} trend={{ value: `${bots.length} total`, positive: true }} />
        <StatCard label="Conversas" value={stats.totalConversations} icon={Users} color="#22c55e" />
        <StatCard label="Mensagens" value={stats.totalMessages} icon={MessageSquare} color="#f59e0b" />
        <StatCard label="WhatsApp" value={connectedBots} icon={Zap} color="#06b6d4" trend={{ value: 'conectados', positive: true }} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-5">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-4">Mensagens por dia</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={mockChartData}>
              <defs>
                <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'var(--color-text-secondary)' }}
              />
              <Area type="monotone" dataKey="mensagens" stroke="var(--color-accent)" fill="url(#gradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-5">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-4">Conversas por dia</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={mockChartData}>
              <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'var(--color-text-secondary)' }}
              />
              <Bar dataKey="conversas" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Bots */}
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-5">
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4" /> Bots Recentes
        </h3>
        {loading ? (
          <p className="text-sm text-[var(--color-text-muted)]">Carregando...</p>
        ) : bots.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">Nenhum bot criado ainda.</p>
        ) : (
          <div className="space-y-2">
            {bots.slice(0, 5).map((bot) => (
              <div key={bot.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${bot.isActive ? 'bg-green-400' : 'bg-[var(--color-text-muted)]'}`} />
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">{bot.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-accent-glow)] text-[var(--color-accent)]">
                    {bot.responseMode}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
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
