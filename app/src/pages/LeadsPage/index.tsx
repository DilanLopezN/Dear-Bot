import { useEffect, useState } from 'react';
import { api, Lead, LeadStats } from '@/services/api';
import { toast } from 'sonner';
import StatCard from '@/components/StatCard';
import {
  Target, RefreshCw, Search, Loader2, Eye, Trash2,
  X, Flame, Thermometer, Snowflake, TrendingUp,
  MessageSquare, Users, Headset, Clock, StickyNote,
  Phone, Mail, ArrowUpDown,
} from 'lucide-react';
import './LeadsPage.css';

interface Bot {
  id: string;
  name: string;
}

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Novo',
  CONTACTED: 'Contactado',
  QUALIFIED: 'Qualificado',
  NEGOTIATION: 'Negociação',
  CONVERTED: 'Convertido',
  LOST: 'Perdido',
};

const TEMP_CONFIG: Record<string, { label: string; className: string }> = {
  HOT: { label: 'Quente', className: 'lead-temp--hot' },
  WARM: { label: 'Morno', className: 'lead-temp--warm' },
  COLD: { label: 'Frio', className: 'lead-temp--cold' },
};

function timeAgo(dateStr?: string): string {
  if (!dateStr) return 'Nunca';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d atrás`;
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

export default function LeadsPage() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tempFilter, setTempFilter] = useState('');
  const [sortBy, setSortBy] = useState('score');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editLostReason, setEditLostReason] = useState('');

  useEffect(() => {
    api.getBots().then((data) => {
      setBots(data);
      if (data.length > 0) setSelectedBotId(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (selectedBotId) {
      loadLeads();
      loadStats();
    }
  }, [selectedBotId, search, statusFilter, tempFilter, sortBy]);

  async function loadLeads() {
    setLoading(true);
    try {
      const data = await api.getLeads(selectedBotId, {
        search: search || undefined,
        status: statusFilter || undefined,
        temperature: tempFilter || undefined,
        sortBy,
      });
      setLeads(data);
    } catch {
      toast.error('Erro ao carregar leads');
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      const data = await api.getLeadStats(selectedBotId);
      setStats(data);
    } catch {
      /* stats are optional */
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await api.syncLeads(selectedBotId);
      toast.success(`${result.synced} leads sincronizados`);
      loadLeads();
      loadStats();
    } catch {
      toast.error('Erro ao sincronizar leads');
    } finally {
      setSyncing(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este lead?')) return;
    try {
      await api.deleteLead(selectedBotId, id);
      toast.success('Lead removido');
      loadLeads();
      loadStats();
    } catch {
      toast.error('Erro ao remover lead');
    }
  }

  async function openDetail(lead: Lead) {
    try {
      const full = await api.getLead(selectedBotId, lead.id);
      setSelectedLead(full);
      setEditStatus(full.status);
      setEditNotes(full.notes || '');
      setEditValue(full.estimatedValue?.toString() || '');
      setEditLostReason(full.lostReason || '');
      setShowDetail(true);
    } catch {
      toast.error('Erro ao carregar detalhes do lead');
    }
  }

  async function handleUpdateLead() {
    if (!selectedLead) return;
    try {
      const payload: Record<string, unknown> = {};
      if (editStatus !== selectedLead.status) payload.status = editStatus;
      if (editNotes !== (selectedLead.notes || '')) payload.notes = editNotes;
      if (editValue !== (selectedLead.estimatedValue?.toString() || ''))
        payload.estimatedValue = editValue ? parseFloat(editValue) : null;
      if (editLostReason !== (selectedLead.lostReason || ''))
        payload.lostReason = editLostReason;

      if (Object.keys(payload).length === 0) {
        setShowDetail(false);
        return;
      }

      await api.updateLead(selectedBotId, selectedLead.id, payload);
      toast.success('Lead atualizado');
      setShowDetail(false);
      loadLeads();
      loadStats();
    } catch {
      toast.error('Erro ao atualizar lead');
    }
  }

  function getScoreColor(score: number): string {
    if (score >= 70) return '#ef4444';
    if (score >= 40) return '#f59e0b';
    return '#6b7280';
  }

  return (
    <div className="leads-page">
      <div className="leads-page__header">
        <div className="leads-page__title-row">
          <div className="leads-page__title-left">
            <div className="leads-page__icon-wrap">
              <Target size={20} />
            </div>
            <div>
              <h1 className="leads-page__title">Leads</h1>
              <p className="leads-page__subtitle">
                Qualifique e acompanhe seus leads por nível de interação
              </p>
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleSync}
            disabled={syncing || !selectedBotId}
          >
            <RefreshCw size={16} className={syncing ? 'spin' : ''} />
            {syncing ? 'Sincronizando...' : 'Sincronizar Leads'}
          </button>
        </div>
      </div>

      {stats && (
        <div className="leads-page__stats">
          <StatCard
            icon={Target}
            label="Total de Leads"
            value={stats.total}
            color="#6366f1"
          />
          <StatCard
            icon={Flame}
            label="Quentes"
            value={stats.hot}
            color="#ef4444"
          />
          <StatCard
            icon={Thermometer}
            label="Mornos"
            value={stats.warm}
            color="#f59e0b"
          />
          <StatCard
            icon={Snowflake}
            label="Frios"
            value={stats.cold}
            color="#6b7280"
          />
        </div>
      )}

      <div className="leads-page__filters">
        <select
          className="form-select"
          value={selectedBotId}
          onChange={(e) => setSelectedBotId(e.target.value)}
        >
          {bots.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <div className="leads-page__search-wrap">
          <Search size={14} className="leads-page__search-icon" />
          <input
            className="form-input leads-page__search"
            placeholder="Buscar por nome, telefone ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="form-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select
          className="form-select"
          value={tempFilter}
          onChange={(e) => setTempFilter(e.target.value)}
        >
          <option value="">Todas temperaturas</option>
          <option value="HOT">Quente</option>
          <option value="WARM">Morno</option>
          <option value="COLD">Frio</option>
        </select>
        <select
          className="form-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="score">Score</option>
          <option value="recent">Mais recente</option>
          <option value="value">Valor estimado</option>
          <option value="name">Nome</option>
        </select>
      </div>

      {loading ? (
        <div className="leads-page__loading">
          <Loader2 size={24} className="spin" />
          <span>Carregando leads...</span>
        </div>
      ) : leads.length === 0 ? (
        <div className="leads-page__empty">
          <Target size={40} opacity={0.3} />
          <p>Nenhum lead encontrado</p>
          <span>Clique em "Sincronizar Leads" para importar contatos do bot como leads</span>
        </div>
      ) : (
        <div className="leads-page__table-wrap">
          <table className="leads-table">
            <thead>
              <tr>
                <th>Contato</th>
                <th>Score</th>
                <th>Temperatura</th>
                <th>Status</th>
                <th>Mensagens</th>
                <th>Última Interação</th>
                <th>Valor</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="leads-table__row">
                  <td>
                    <div className="leads-table__contact">
                      <div className="leads-table__avatar">
                        {(lead.contact?.name ?? lead.contact?.phone ?? '?')[0].toUpperCase()}
                      </div>
                      <div className="leads-table__contact-info">
                        <strong>{lead.contact?.name || 'Sem nome'}</strong>
                        <span><Phone size={10} /> {lead.contact?.phone}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="leads-table__score">
                      <div className="score-bar">
                        <div
                          className="score-bar__fill"
                          style={{
                            width: `${lead.score}%`,
                            background: getScoreColor(lead.score),
                          }}
                        />
                      </div>
                      <span className="score-bar__value">{lead.score}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`lead-temp ${TEMP_CONFIG[lead.temperature]?.className}`}>
                      {lead.temperature === 'HOT' && <Flame size={12} />}
                      {lead.temperature === 'WARM' && <Thermometer size={12} />}
                      {lead.temperature === 'COLD' && <Snowflake size={12} />}
                      {TEMP_CONFIG[lead.temperature]?.label}
                    </span>
                  </td>
                  <td>
                    <span className={`lead-status lead-status--${lead.status.toLowerCase()}`}>
                      {STATUS_LABELS[lead.status]}
                    </span>
                  </td>
                  <td>
                    <span className="leads-table__messages">
                      <MessageSquare size={12} />
                      {lead.totalMessages}
                    </span>
                  </td>
                  <td>
                    <span className="leads-table__time">
                      <Clock size={12} />
                      {timeAgo(lead.lastInteractionAt)}
                    </span>
                  </td>
                  <td>
                    {lead.estimatedValue
                      ? `R$ ${lead.estimatedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                      : '-'}
                  </td>
                  <td>
                    <div className="leads-table__actions">
                      <button className="icon-btn" onClick={() => openDetail(lead)} title="Detalhes">
                        <Eye size={14} />
                      </button>
                      <button className="icon-btn icon-btn--danger" onClick={() => handleDelete(lead.id)} title="Excluir">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && selectedLead && (
        <div className="modal-overlay" onClick={() => setShowDetail(false)}>
          <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2>Detalhes do Lead</h2>
              <button className="modal__close" onClick={() => setShowDetail(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal__body lead-detail">
              {/* Contact info */}
              <div className="lead-detail__contact">
                <div className="leads-table__avatar leads-table__avatar--lg">
                  {(selectedLead.contact?.name ?? selectedLead.contact?.phone ?? '?')[0].toUpperCase()}
                </div>
                <div>
                  <h3>{selectedLead.contact?.name || 'Sem nome'}</h3>
                  <p><Phone size={12} /> {selectedLead.contact?.phone}</p>
                  {selectedLead.contact?.email && (
                    <p><Mail size={12} /> {selectedLead.contact.email}</p>
                  )}
                </div>
                <div className="lead-detail__score-big">
                  <div
                    className="lead-detail__score-circle"
                    style={{ borderColor: getScoreColor(selectedLead.score) }}
                  >
                    <span>{selectedLead.score}</span>
                  </div>
                  <span className={`lead-temp ${TEMP_CONFIG[selectedLead.temperature]?.className}`}>
                    {TEMP_CONFIG[selectedLead.temperature]?.label}
                  </span>
                </div>
              </div>

              {/* Metrics grid */}
              <div className="lead-detail__metrics">
                <div className="lead-metric">
                  <MessageSquare size={16} />
                  <div>
                    <span className="lead-metric__value">{selectedLead.totalMessages}</span>
                    <span className="lead-metric__label">Mensagens</span>
                  </div>
                </div>
                <div className="lead-metric">
                  <ArrowUpDown size={16} />
                  <div>
                    <span className="lead-metric__value">{selectedLead.inboundMessages} / {selectedLead.outboundMessages}</span>
                    <span className="lead-metric__label">Entrada / Saída</span>
                  </div>
                </div>
                <div className="lead-metric">
                  <Users size={16} />
                  <div>
                    <span className="lead-metric__value">{selectedLead.totalConversations}</span>
                    <span className="lead-metric__label">Conversas</span>
                  </div>
                </div>
                <div className="lead-metric">
                  <Headset size={16} />
                  <div>
                    <span className="lead-metric__value">{selectedLead.humanTakeovers}</span>
                    <span className="lead-metric__label">Atend. Humano</span>
                  </div>
                </div>
                <div className="lead-metric">
                  <TrendingUp size={16} />
                  <div>
                    <span className="lead-metric__value">{Math.round(selectedLead.responseRate * 100)}%</span>
                    <span className="lead-metric__label">Taxa de Resposta</span>
                  </div>
                </div>
                <div className="lead-metric">
                  <Clock size={16} />
                  <div>
                    <span className="lead-metric__value">{timeAgo(selectedLead.lastInteractionAt)}</span>
                    <span className="lead-metric__label">Última Interação</span>
                  </div>
                </div>
              </div>

              {/* Edit fields */}
              <div className="lead-detail__fields">
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                  >
                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Valor Estimado (R$)</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                  />
                </div>

                {editStatus === 'LOST' && (
                  <div className="form-group">
                    <label className="form-label">Motivo da Perda</label>
                    <input
                      className="form-input"
                      placeholder="Ex: preço, concorrente, desistiu..."
                      value={editLostReason}
                      onChange={(e) => setEditLostReason(e.target.value)}
                    />
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Observações</label>
                  <textarea
                    className="form-input form-textarea"
                    placeholder="Anotações sobre o lead..."
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              {/* History timeline */}
              {selectedLead.history && selectedLead.history.length > 0 && (
                <div className="lead-detail__history">
                  <h4><Clock size={14} /> Histórico</h4>
                  <div className="lead-timeline">
                    {selectedLead.history.map((entry) => (
                      <div key={entry.id} className="lead-timeline__item">
                        <div className="lead-timeline__dot" />
                        <div className="lead-timeline__content">
                          <span className="lead-timeline__action">
                            {entry.action === 'status_change' && 'Mudança de status'}
                            {entry.action === 'note_added' && 'Nota adicionada'}
                            {entry.action === 'score_update' && 'Score atualizado'}
                          </span>
                          {entry.details && (
                            <span className="lead-timeline__details">
                              {entry.action === 'status_change'
                                ? (() => {
                                    try {
                                      const d = JSON.parse(entry.details);
                                      return `${STATUS_LABELS[d.from] || d.from} → ${STATUS_LABELS[d.to] || d.to}`;
                                    } catch {
                                      return entry.details;
                                    }
                                  })()
                                : entry.details
                              }
                            </span>
                          )}
                          <span className="lead-timeline__date">
                            {new Date(entry.createdAt).toLocaleString('pt-BR')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="modal__footer">
                <button type="button" className="btn-ghost" onClick={() => setShowDetail(false)}>
                  Cancelar
                </button>
                <button type="button" className="btn-primary" onClick={handleUpdateLead}>
                  Salvar Alterações
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
