import { useEffect, useState } from 'react';
import { useBotStore } from '@/stores/bot.store';
import { api } from '@/services/api';
import {
  BarChart3, MessageSquare, Users, TrendingUp,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4'];

export default function RelatoriosPage() {
  const { bots, fetchBots } = useBotStore();
  const [botStats, setBotStats] = useState<any[]>([]);
  const [modeData, setModeData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchBots(); }, [fetchBots]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const stats: any[] = [];
      const modes: Record<string, number> = {};

      for (const bot of bots) {
        try {
          const convs = await api.getConversations(bot.id);
          const totalMsgs = convs.reduce((acc: number, c: any) => acc + (c._count?.messages || 0), 0);
          stats.push({ name: bot.name.slice(0, 12), conversas: convs.length, mensagens: totalMsgs });
          modes[bot.responseMode] = (modes[bot.responseMode] || 0) + 1;
        } catch {
          stats.push({ name: bot.name.slice(0, 12), conversas: 0, mensagens: 0 });
        }
      }

      setBotStats(stats);
      setModeData(Object.entries(modes).map(([name, value]) => ({ name, value })));
      setLoading(false);
    };
    if (bots.length) load();
    else setLoading(false);
  }, [bots]);

  const totalConversas = botStats.reduce((a, b) => a + b.conversas, 0);
  const totalMensagens = botStats.reduce((a, b) => a + b.mensagens, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>Relatórios</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1.5">Análise de desempenho dos bots</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: 'Total Bots', value: bots.length, icon: BarChart3, color: 'var(--color-accent)' },
          { label: 'Total Conversas', value: totalConversas, icon: Users, color: '#22c55e' },
          { label: 'Total Mensagens', value: totalMensagens, icon: MessageSquare, color: '#f59e0b' },
          { label: 'Média msg/bot', value: bots.length ? Math.round(totalMensagens / bots.length) : 0, icon: TrendingUp, color: '#06b6d4' },
        ].map((s) => (
          <div key={s.label} className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">{s.label}</p>
              <s.icon className="w-4 h-4" style={{ color: s.color }} />
            </div>
            <p className="text-2xl font-bold text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-10">Carregando relatórios...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Mensagens por Bot */}
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6">
            <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-5">Mensagens por Bot</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={botStats}>
                <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="mensagens" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="conversas" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Distribuição por modo */}
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6">
            <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-5">Distribuição por Modo</h3>
            {modeData.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)] text-center py-10">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={modeData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {modeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
