import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { toast } from 'sonner';
import {
  Users, ShieldCheck, BarChart3, DollarSign, Bot, MessageSquare,
  Search, Edit2, Trash2, Power, PowerOff, Eye, LogOut, Loader2,
  Crown, UserCheck, UserX, TrendingUp,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import './AdminPanel.css';

const PLAN_COLORS: Record<string, string> = {
  TESTER: '#9ca3af',
  PRO: '#22c55e',
  ENTERPRISE: '#a855f7',
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

interface DashboardData {
  totals: {
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    totalBots: number;
    totalConversations: number;
    totalMessages: number;
    activeSubscriptions: number;
    mrr: number;
  };
  planDistribution: Array<{ name: string; value: number }>;
  billingDistribution: Array<{ name: string; value: number }>;
  recentUsers: Array<{ id: string; name: string; email: string; plan: string; planActive: boolean; createdAt: string }>;
  monthlySignups: Array<{ date: string; signups: number }>;
}

interface UserData {
  id: string;
  email: string;
  name: string;
  plan: string;
  planActive: boolean;
  planExpiresAt: string | null;
  cpfCnpj: string | null;
  createdAt: string;
  _count: { bots: number };
  subscription: {
    plan: string;
    status: string;
    value: number;
    billingType: string;
    nextDueDate: string | null;
    lastPaymentAt: string | null;
  } | null;
}

// ── Login Screen ──────────────────────────────────────────
function AdminLogin({ onLogin }: { onLogin: (token: string) => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.adminLogin(password);
      if (res.success) {
        onLogin(res.token);
      } else {
        setError(res.message || 'Senha incorreta');
      }
    } catch {
      setError('Erro ao conectar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login">
      <form className="admin-login__card" onSubmit={handleSubmit}>
        <h1 className="admin-login__title">Admin Panel</h1>
        <p className="admin-login__subtitle">Acesso restrito. Insira a senha de administrador.</p>
        {error && <p className="admin-login__error">{error}</p>}
        <input
          type="password"
          className="admin-login__input"
          placeholder="Senha de admin..."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        <button type="submit" className="admin-login__btn" disabled={loading || !password}>
          {loading ? 'Verificando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

// ── Dashboard Tab ──────────────────────────────────────────
function DashboardTab({ token }: { token: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.adminGetDashboard(token)
      .then(setData)
      .catch(() => toast.error('Erro ao carregar dashboard'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const { totals, planDistribution, billingDistribution, recentUsers, monthlySignups } = data;

  return (
    <div>
      <h2 className="admin__section-title">Dashboard de Vendas</h2>

      <div className="admin__stats">
        <div className="admin__stat">
          <div className="admin__stat-info">
            <p className="admin__stat-label">Total Usuarios</p>
            <p className="admin__stat-value">{totals.totalUsers}</p>
          </div>
          <div className="admin__stat-icon" style={{ background: 'rgba(34,197,94,0.12)' }}>
            <Users size={22} color="#22c55e" />
          </div>
        </div>
        <div className="admin__stat">
          <div className="admin__stat-info">
            <p className="admin__stat-label">Ativos</p>
            <p className="admin__stat-value">{totals.activeUsers}</p>
          </div>
          <div className="admin__stat-icon" style={{ background: 'rgba(59,130,246,0.12)' }}>
            <UserCheck size={22} color="#3b82f6" />
          </div>
        </div>
        <div className="admin__stat">
          <div className="admin__stat-info">
            <p className="admin__stat-label">Inativos</p>
            <p className="admin__stat-value">{totals.inactiveUsers}</p>
          </div>
          <div className="admin__stat-icon" style={{ background: 'rgba(239,68,68,0.12)' }}>
            <UserX size={22} color="#ef4444" />
          </div>
        </div>
        <div className="admin__stat">
          <div className="admin__stat-info">
            <p className="admin__stat-label">MRR</p>
            <p className="admin__stat-value">R$ {totals.mrr.toFixed(2)}</p>
          </div>
          <div className="admin__stat-icon" style={{ background: 'rgba(245,158,11,0.12)' }}>
            <DollarSign size={22} color="#f59e0b" />
          </div>
        </div>
        <div className="admin__stat">
          <div className="admin__stat-info">
            <p className="admin__stat-label">Assinaturas Ativas</p>
            <p className="admin__stat-value">{totals.activeSubscriptions}</p>
          </div>
          <div className="admin__stat-icon" style={{ background: 'rgba(168,85,247,0.12)' }}>
            <Crown size={22} color="#a855f7" />
          </div>
        </div>
        <div className="admin__stat">
          <div className="admin__stat-info">
            <p className="admin__stat-label">Total Bots</p>
            <p className="admin__stat-value">{totals.totalBots}</p>
          </div>
          <div className="admin__stat-icon" style={{ background: 'rgba(6,182,212,0.12)' }}>
            <Bot size={22} color="#06b6d4" />
          </div>
        </div>
        <div className="admin__stat">
          <div className="admin__stat-info">
            <p className="admin__stat-label">Conversas</p>
            <p className="admin__stat-value">{totals.totalConversations}</p>
          </div>
          <div className="admin__stat-icon" style={{ background: 'rgba(34,197,94,0.12)' }}>
            <MessageSquare size={22} color="#22c55e" />
          </div>
        </div>
        <div className="admin__stat">
          <div className="admin__stat-info">
            <p className="admin__stat-label">Mensagens</p>
            <p className="admin__stat-value">{totals.totalMessages}</p>
          </div>
          <div className="admin__stat-icon" style={{ background: 'rgba(236,72,153,0.12)' }}>
            <TrendingUp size={22} color="#ec4899" />
          </div>
        </div>
      </div>

      <div className="admin__charts">
        <div className="admin__chart-card">
          <h3 className="admin__chart-title">Novos usuarios (30 dias)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={monthlySignups}>
              <defs>
                <linearGradient id="gradSignup" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} width={32} />
              <Tooltip {...tooltipStyle} />
              <Area type="monotone" dataKey="signups" stroke="#22c55e" fill="url(#gradSignup)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="admin__chart-card">
          <h3 className="admin__chart-title">Distribuicao por Plano</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={planDistribution}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={4}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {planDistribution.map((entry) => (
                  <Cell key={entry.name} fill={PLAN_COLORS[entry.name] || '#6b7280'} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="admin__chart-card">
          <h3 className="admin__chart-title">Metodos de Pagamento</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={billingDistribution}>
              <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} width={32} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="value" fill="#a855f7" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="admin__chart-card">
          <h3 className="admin__chart-title">Usuarios Recentes</h3>
          <div className="admin__recent-list">
            {recentUsers.map((u) => (
              <div key={u.id} className="admin__recent-item">
                <div>
                  <div className="admin__recent-name">{u.name}</div>
                  <div className="admin__recent-email">{u.email}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className={`admin__badge admin__badge--${u.plan.toLowerCase()}`}>{u.plan}</span>
                  <div className="admin__recent-date">
                    {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Users Tab ──────────────────────────────────────────
function UsersTab({ token }: { token: string }) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', cpfCnpj: '' });
  const [planModal, setPlanModal] = useState<UserData | null>(null);
  const [planForm, setPlanForm] = useState({ plan: 'TESTER', planActive: true, planDays: 0 });
  const [detailUser, setDetailUser] = useState<any>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.adminGetUsers(token, {
        search: search || undefined,
        plan: planFilter || undefined,
        active: activeFilter || undefined,
      });
      setUsers(data);
    } catch {
      toast.error('Erro ao carregar usuarios');
    } finally {
      setLoading(false);
    }
  }, [token, search, planFilter, activeFilter]);

  useEffect(() => {
    const debounce = setTimeout(fetchUsers, 300);
    return () => clearTimeout(debounce);
  }, [fetchUsers]);

  const handleEdit = (user: UserData) => {
    setEditForm({ name: user.name, email: user.email, cpfCnpj: user.cpfCnpj || '' });
    setEditingUser(user);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    try {
      await api.adminUpdateUser(token, editingUser.id, editForm);
      toast.success('Usuario atualizado!');
      setEditingUser(null);
      fetchUsers();
    } catch {
      toast.error('Erro ao atualizar');
    }
  };

  const handlePlanModal = (user: UserData) => {
    setPlanForm({ plan: user.plan, planActive: user.planActive, planDays: 0 });
    setPlanModal(user);
  };

  const handleSavePlan = async () => {
    if (!planModal) return;
    try {
      await api.adminUpdateUserPlan(token, planModal.id, {
        plan: planForm.plan,
        planActive: planForm.planActive,
        planDays: planForm.planDays || undefined,
      });
      toast.success('Plano atualizado!');
      setPlanModal(null);
      fetchUsers();
    } catch {
      toast.error('Erro ao atualizar plano');
    }
  };

  const handleToggleActive = async (user: UserData) => {
    try {
      await api.adminUpdateUserPlan(token, user.id, {
        plan: user.plan,
        planActive: !user.planActive,
      });
      toast.success(user.planActive ? 'Plano desativado' : 'Plano ativado');
      fetchUsers();
    } catch {
      toast.error('Erro ao alterar status');
    }
  };

  const handleDelete = async (user: UserData) => {
    if (!confirm(`Tem certeza que deseja deletar ${user.name}? Essa acao e irreversivel.`)) return;
    try {
      await api.adminDeleteUser(token, user.id);
      toast.success('Usuario deletado');
      fetchUsers();
    } catch {
      toast.error('Erro ao deletar');
    }
  };

  const handleViewDetail = async (user: UserData) => {
    try {
      const data = await api.adminGetUser(token, user.id);
      setDetailUser(data);
    } catch {
      toast.error('Erro ao carregar detalhes');
    }
  };

  return (
    <div>
      <h2 className="admin__section-title">Gerenciar Usuarios</h2>

      <div className="admin__toolbar">
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            className="admin__search"
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
        </div>
        <select className="admin__filter" value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
          <option value="">Todos os planos</option>
          <option value="TESTER">Tester</option>
          <option value="PRO">Pro</option>
          <option value="ENTERPRISE">Enterprise</option>
        </select>
        <select className="admin__filter" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
          <option value="">Todos</option>
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
        </select>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : (
        <div className="admin__table-wrap">
          <table className="admin__table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Plano</th>
                <th>Status</th>
                <th>Bots</th>
                <th>Assinatura</th>
                <th>Criado em</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td style={{ fontWeight: 600 }}>{user.name}</td>
                  <td style={{ color: 'var(--color-text-muted)' }}>{user.email}</td>
                  <td>
                    <span className={`admin__badge admin__badge--${user.plan.toLowerCase()}`}>
                      {user.plan}
                    </span>
                  </td>
                  <td>
                    <span className={`admin__badge admin__badge--${user.planActive ? 'active' : 'inactive'}`}>
                      {user.planActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>{user._count.bots}</td>
                  <td>
                    {user.subscription ? (
                      <span style={{ fontSize: 12 }}>
                        {user.subscription.status} - R${user.subscription.value}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Nenhuma</span>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td>
                    <div className="admin__actions">
                      <button className="admin__action-btn" onClick={() => handleViewDetail(user)} title="Ver detalhes">
                        <Eye size={13} />
                      </button>
                      <button className="admin__action-btn" onClick={() => handleEdit(user)} title="Editar">
                        <Edit2 size={13} />
                      </button>
                      <button className="admin__action-btn admin__action-btn--success" onClick={() => handlePlanModal(user)} title="Gerenciar plano">
                        <Crown size={13} />
                      </button>
                      <button
                        className={`admin__action-btn ${user.planActive ? 'admin__action-btn--danger' : 'admin__action-btn--success'}`}
                        onClick={() => handleToggleActive(user)}
                        title={user.planActive ? 'Desativar' : 'Ativar'}
                      >
                        {user.planActive ? <PowerOff size={13} /> : <Power size={13} />}
                      </button>
                      <button className="admin__action-btn admin__action-btn--danger" onClick={() => handleDelete(user)} title="Deletar">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
                    Nenhum usuario encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="admin__modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="admin__modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="admin__modal-title">Editar Usuario</h3>
            <div className="admin__form-group">
              <label className="admin__form-label">Nome</label>
              <input
                className="admin__form-input"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="admin__form-group">
              <label className="admin__form-label">Email</label>
              <input
                className="admin__form-input"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div className="admin__form-group">
              <label className="admin__form-label">CPF/CNPJ</label>
              <input
                className="admin__form-input"
                value={editForm.cpfCnpj}
                onChange={(e) => setEditForm({ ...editForm, cpfCnpj: e.target.value })}
              />
            </div>
            <div className="admin__modal-actions">
              <button className="admin__btn admin__btn--secondary" onClick={() => setEditingUser(null)}>Cancelar</button>
              <button className="admin__btn admin__btn--primary" onClick={handleSaveEdit}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Plan Modal */}
      {planModal && (
        <div className="admin__modal-overlay" onClick={() => setPlanModal(null)}>
          <div className="admin__modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="admin__modal-title">Gerenciar Plano - {planModal.name}</h3>
            <div className="admin__form-group">
              <label className="admin__form-label">Plano</label>
              <select
                className="admin__form-select"
                value={planForm.plan}
                onChange={(e) => setPlanForm({ ...planForm, plan: e.target.value })}
              >
                <option value="TESTER">Tester</option>
                <option value="PRO">Pro</option>
                <option value="ENTERPRISE">Enterprise</option>
              </select>
            </div>
            <div className="admin__form-group">
              <label className="admin__form-label">Status</label>
              <select
                className="admin__form-select"
                value={planForm.planActive ? 'true' : 'false'}
                onChange={(e) => setPlanForm({ ...planForm, planActive: e.target.value === 'true' })}
              >
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </select>
            </div>
            <div className="admin__form-group">
              <label className="admin__form-label">Dias de validade (0 = ilimitado)</label>
              <input
                type="number"
                className="admin__form-input"
                value={planForm.planDays}
                onChange={(e) => setPlanForm({ ...planForm, planDays: Number(e.target.value) })}
                min={0}
              />
            </div>
            <div className="admin__modal-actions">
              <button className="admin__btn admin__btn--secondary" onClick={() => setPlanModal(null)}>Cancelar</button>
              <button className="admin__btn admin__btn--primary" onClick={handleSavePlan}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailUser && (
        <div className="admin__modal-overlay" onClick={() => setDetailUser(null)}>
          <div className="admin__modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="admin__modal-title">Detalhes - {detailUser.name}</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <span className="admin__form-label">Email</span>
                <p style={{ fontSize: 14 }}>{detailUser.email}</p>
              </div>
              <div>
                <span className="admin__form-label">Plano</span>
                <p>
                  <span className={`admin__badge admin__badge--${detailUser.plan.toLowerCase()}`}>{detailUser.plan}</span>
                  {' '}
                  <span className={`admin__badge admin__badge--${detailUser.planActive ? 'active' : 'inactive'}`}>
                    {detailUser.planActive ? 'Ativo' : 'Inativo'}
                  </span>
                </p>
              </div>
              {detailUser.planExpiresAt && (
                <div>
                  <span className="admin__form-label">Expira em</span>
                  <p style={{ fontSize: 14 }}>{new Date(detailUser.planExpiresAt).toLocaleDateString('pt-BR')}</p>
                </div>
              )}
              {detailUser.cpfCnpj && (
                <div>
                  <span className="admin__form-label">CPF/CNPJ</span>
                  <p style={{ fontSize: 14 }}>{detailUser.cpfCnpj}</p>
                </div>
              )}
              {detailUser.subscription && (
                <div>
                  <span className="admin__form-label">Assinatura</span>
                  <p style={{ fontSize: 14 }}>
                    {detailUser.subscription.status} - R${detailUser.subscription.value} ({detailUser.subscription.billingType})
                  </p>
                </div>
              )}
              <div>
                <span className="admin__form-label">Total de Bots</span>
                <p style={{ fontSize: 14 }}>{detailUser._count.bots}</p>
              </div>
              {detailUser.bots && detailUser.bots.length > 0 && (
                <div>
                  <span className="admin__form-label">Bots</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                    {detailUser.bots.map((bot: any) => (
                      <div key={bot.id} style={{
                        padding: '8px 12px',
                        background: 'var(--color-bg-tertiary)',
                        borderRadius: 8,
                        fontSize: 13,
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}>
                        <span style={{ fontWeight: 600 }}>{bot.name}</span>
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          {bot._count.conversations} conversas | {bot._count.keywords} keywords
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <span className="admin__form-label">Criado em</span>
                <p style={{ fontSize: 14 }}>{new Date(detailUser.createdAt).toLocaleString('pt-BR')}</p>
              </div>
            </div>
            <div className="admin__modal-actions">
              <button className="admin__btn admin__btn--secondary" onClick={() => setDetailUser(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Admin Panel ──────────────────────────────────────────
export default function AdminPanel() {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('admin_token'));
  const [tab, setTab] = useState<'dashboard' | 'users'>('dashboard');

  const handleLogin = (t: string) => {
    sessionStorage.setItem('admin_token', t);
    setToken(t);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_token');
    setToken(null);
  };

  if (!token) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return (
    <div className="admin">
      <header className="admin__header">
        <div className="admin__header-left">
          <span className="admin__logo">
            <ShieldCheck size={18} style={{ display: 'inline', verticalAlign: -3, marginRight: 6 }} />
            Admin Panel
          </span>
          <nav className="admin__nav">
            <button
              className={`admin__nav-btn ${tab === 'dashboard' ? 'admin__nav-btn--active' : ''}`}
              onClick={() => setTab('dashboard')}
            >
              <BarChart3 size={13} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />
              Dashboard
            </button>
            <button
              className={`admin__nav-btn ${tab === 'users' ? 'admin__nav-btn--active' : ''}`}
              onClick={() => setTab('users')}
            >
              <Users size={13} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />
              Usuarios
            </button>
          </nav>
        </div>
        <button className="admin__logout" onClick={handleLogout}>
          <LogOut size={13} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />
          Sair
        </button>
      </header>

      <main className="admin__content">
        {tab === 'dashboard' && <DashboardTab token={token} />}
        {tab === 'users' && <UsersTab token={token} />}
      </main>
    </div>
  );
}
