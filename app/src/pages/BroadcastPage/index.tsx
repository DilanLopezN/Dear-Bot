import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { toast } from 'sonner';
import {
  Megaphone, Plus, Trash2, X, Loader2, List,
  Send, Ban, CheckCircle2, XCircle, Clock,
  Users, FileText, ChevronRight,
} from 'lucide-react';
import './BroadcastPage.css';

type BroadcastStatus = 'DRAFT' | 'SENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

interface BroadcastList {
  id: string;
  name: string;
  phones: string[];
  _count?: { broadcasts: number };
}

interface Broadcast {
  id: string;
  name: string;
  message: string;
  phones: string[];
  status: BroadcastStatus;
  scheduledAt?: string;
  completedAt?: string;
  totalRecipients: number;
  successCount: number;
  failCount: number;
  createdAt: string;
  list?: { id: string; name: string } | null;
}

interface Bot { id: string; name: string; }

const STATUS_LABELS: Record<BroadcastStatus, { label: string; className: string; icon: React.ElementType }> = {
  DRAFT: { label: 'Rascunho', className: 'badge--pending', icon: FileText },
  SENDING: { label: 'Enviando', className: 'badge--sending', icon: Loader2 },
  COMPLETED: { label: 'Concluído', className: 'badge--sent', icon: CheckCircle2 },
  FAILED: { label: 'Falhou', className: 'badge--failed', icon: XCircle },
  CANCELLED: { label: 'Cancelado', className: 'badge--cancelled', icon: Ban },
};

type Tab = 'broadcasts' | 'lists';

export default function BroadcastPage() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState('');
  const [tab, setTab] = useState<Tab>('broadcasts');

  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [lists, setLists] = useState<BroadcastList[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal states
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [editingList, setEditingList] = useState<BroadcastList | null>(null);

  const [broadcastForm, setBroadcastForm] = useState({
    name: '',
    message: '',
    listId: '',
    phones: '',
    scheduledAt: '',
  });

  const [listForm, setListForm] = useState({
    name: '',
    phones: '',
  });

  useEffect(() => {
    api.getBots().then((data) => {
      setBots(data);
      if (data.length > 0) setSelectedBotId(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (selectedBotId) {
      loadBroadcasts();
      loadLists();
    }
  }, [selectedBotId]);

  async function loadBroadcasts() {
    setLoading(true);
    try {
      const data = await api.getBroadcasts(selectedBotId);
      setBroadcasts(data);
    } catch {
      toast.error('Erro ao carregar broadcasts');
    } finally {
      setLoading(false);
    }
  }

  async function loadLists() {
    try {
      const data = await api.getBroadcastLists(selectedBotId);
      setLists(data);
    } catch {
      toast.error('Erro ao carregar listas');
    }
  }

  // ── Broadcast actions ─────────────────────────────────────────────────────

  function openBroadcastModal() {
    setBroadcastForm({ name: '', message: '', listId: '', phones: '', scheduledAt: '' });
    setShowBroadcastModal(true);
  }

  async function handleCreateBroadcast(e: React.FormEvent) {
    e.preventDefault();
    const phonesArr = broadcastForm.phones
      ? broadcastForm.phones.split(/[\n,]/).map((p) => p.trim()).filter(Boolean)
      : [];
    try {
      await api.createBroadcast(selectedBotId, {
        name: broadcastForm.name.trim(),
        message: broadcastForm.message.trim(),
        listId: broadcastForm.listId || undefined,
        phones: phonesArr.length > 0 ? phonesArr : undefined,
        scheduledAt: broadcastForm.scheduledAt
          ? new Date(broadcastForm.scheduledAt).toISOString()
          : undefined,
      });
      toast.success('Broadcast criado com sucesso!');
      setShowBroadcastModal(false);
      loadBroadcasts();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Erro ao criar broadcast');
    }
  }

  async function handleSendNow(id: string) {
    try {
      await api.sendBroadcastNow(selectedBotId, id);
      toast.success('Broadcast iniciado!');
      loadBroadcasts();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Erro ao iniciar broadcast');
    }
  }

  async function handleCancelBroadcast(id: string) {
    try {
      await api.cancelBroadcast(selectedBotId, id);
      toast.success('Broadcast cancelado');
      loadBroadcasts();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Erro ao cancelar');
    }
  }

  async function handleDeleteBroadcast(id: string) {
    if (!confirm('Excluir este broadcast?')) return;
    try {
      await api.deleteBroadcast(selectedBotId, id);
      toast.success('Broadcast removido');
      loadBroadcasts();
    } catch {
      toast.error('Erro ao remover broadcast');
    }
  }

  // ── List actions ──────────────────────────────────────────────────────────

  function openCreateList() {
    setEditingList(null);
    setListForm({ name: '', phones: '' });
    setShowListModal(true);
  }

  function openEditList(list: BroadcastList) {
    setEditingList(list);
    setListForm({ name: list.name, phones: list.phones.join('\n') });
    setShowListModal(true);
  }

  async function handleSaveList(e: React.FormEvent) {
    e.preventDefault();
    const phones = listForm.phones
      .split(/[\n,]/)
      .map((p) => p.trim())
      .filter(Boolean);
    try {
      if (editingList) {
        await api.updateBroadcastList(selectedBotId, editingList.id, { name: listForm.name, phones });
        toast.success('Lista atualizada');
      } else {
        await api.createBroadcastList(selectedBotId, { name: listForm.name, phones });
        toast.success('Lista criada');
      }
      setShowListModal(false);
      loadLists();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Erro ao salvar lista');
    }
  }

  async function handleDeleteList(id: string) {
    if (!confirm('Excluir esta lista?')) return;
    try {
      await api.deleteBroadcastList(selectedBotId, id);
      toast.success('Lista removida');
      loadLists();
    } catch {
      toast.error('Erro ao remover lista');
    }
  }

  return (
    <div className="broadcast-page">
      <div className="broadcast-page__header">
        <div className="broadcast-page__title-row">
          <div className="broadcast-page__title-left">
            <div className="broadcast-page__icon-wrap">
              <Megaphone size={20} />
            </div>
            <div>
              <h1 className="broadcast-page__title">Lista de Transmissão</h1>
              <p className="broadcast-page__subtitle">
                Envie mensagens em massa para múltiplos contatos
              </p>
            </div>
          </div>
          <div className="broadcast-page__header-actions">
            <select
              className="form-select"
              value={selectedBotId}
              onChange={(e) => setSelectedBotId(e.target.value)}
            >
              {bots.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            {tab === 'broadcasts' ? (
              <button className="btn-primary" onClick={openBroadcastModal}>
                <Plus size={15} /> Novo Broadcast
              </button>
            ) : (
              <button className="btn-primary" onClick={openCreateList}>
                <Plus size={15} /> Nova Lista
              </button>
            )}
          </div>
        </div>

        <div className="broadcast-page__tabs">
          <button
            className={`broadcast-page__tab ${tab === 'broadcasts' ? 'broadcast-page__tab--active' : ''}`}
            onClick={() => setTab('broadcasts')}
          >
            <Send size={14} /> Broadcasts
          </button>
          <button
            className={`broadcast-page__tab ${tab === 'lists' ? 'broadcast-page__tab--active' : ''}`}
            onClick={() => setTab('lists')}
          >
            <List size={14} /> Listas de Contatos
          </button>
        </div>
      </div>

      {/* ── Broadcasts tab ── */}
      {tab === 'broadcasts' && (
        loading ? (
          <div className="broadcast-page__loading"><Loader2 size={24} className="spin" /><span>Carregando...</span></div>
        ) : broadcasts.length === 0 ? (
          <div className="broadcast-page__empty">
            <Megaphone size={40} opacity={0.3} />
            <p>Nenhum broadcast criado</p>
            <span>Crie um broadcast para enviar mensagens em massa</span>
          </div>
        ) : (
          <div className="broadcast-list">
            {broadcasts.map((bc) => {
              const statusInfo = STATUS_LABELS[bc.status];
              const StatusIcon = statusInfo.icon;
              return (
                <div key={bc.id} className="broadcast-card">
                  <div className="broadcast-card__top">
                    <div className="broadcast-card__title-row">
                      <strong className="broadcast-card__name">{bc.name}</strong>
                      <span className={`badge ${statusInfo.className}`}>
                        <StatusIcon size={11} /> {statusInfo.label}
                      </span>
                    </div>
                    <p className="broadcast-card__message">{bc.message}</p>
                    {bc.list && (
                      <div className="broadcast-card__list-ref">
                        <List size={12} /> Lista: <strong>{bc.list.name}</strong>
                      </div>
                    )}
                  </div>
                  <div className="broadcast-card__stats">
                    <div className="broadcast-card__stat">
                      <Users size={13} />
                      <span>{bc.totalRecipients} destinatários</span>
                    </div>
                    {bc.status === 'COMPLETED' && (
                      <>
                        <div className="broadcast-card__stat broadcast-card__stat--success">
                          <CheckCircle2 size={13} /> {bc.successCount} enviados
                        </div>
                        <div className="broadcast-card__stat broadcast-card__stat--fail">
                          <XCircle size={13} /> {bc.failCount} falhas
                        </div>
                      </>
                    )}
                    {bc.scheduledAt && bc.status === 'DRAFT' && (
                      <div className="broadcast-card__stat">
                        <Clock size={13} />
                        <span>Agendado: {new Date(bc.scheduledAt).toLocaleString('pt-BR')}</span>
                      </div>
                    )}
                  </div>
                  <div className="broadcast-card__actions">
                    <span className="broadcast-card__date">
                      {new Date(bc.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                    <div className="broadcast-card__btns">
                      {bc.status === 'DRAFT' && (
                        <button className="btn-success btn-sm" onClick={() => handleSendNow(bc.id)}>
                          <Send size={13} /> Enviar Agora
                        </button>
                      )}
                      {['DRAFT', 'SENDING'].includes(bc.status) && (
                        <button className="icon-btn icon-btn--warn" onClick={() => handleCancelBroadcast(bc.id)} title="Cancelar">
                          <Ban size={14} />
                        </button>
                      )}
                      <button className="icon-btn icon-btn--danger" onClick={() => handleDeleteBroadcast(bc.id)} title="Excluir">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── Lists tab ── */}
      {tab === 'lists' && (
        lists.length === 0 ? (
          <div className="broadcast-page__empty">
            <Users size={40} opacity={0.3} />
            <p>Nenhuma lista de transmissão</p>
            <span>Crie listas para organizar contatos e enviar broadcasts</span>
          </div>
        ) : (
          <div className="broadcast-lists-grid">
            {lists.map((list) => (
              <div key={list.id} className="broadcast-list-card">
                <div className="broadcast-list-card__header">
                  <div className="broadcast-list-card__icon">
                    <Users size={18} />
                  </div>
                  <div className="broadcast-list-card__info">
                    <strong>{list.name}</strong>
                    <span>{list.phones.length} contatos</span>
                  </div>
                  <div className="broadcast-list-card__actions">
                    <button className="icon-btn" onClick={() => openEditList(list)} title="Editar">
                      <ChevronRight size={14} />
                    </button>
                    <button className="icon-btn icon-btn--danger" onClick={() => handleDeleteList(list.id)} title="Excluir">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {list._count && (
                  <div className="broadcast-list-card__footer">
                    {list._count.broadcasts} broadcasts realizados
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Broadcast Modal ── */}
      {showBroadcastModal && (
        <div className="modal-overlay" onClick={() => setShowBroadcastModal(false)}>
          <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2>Novo Broadcast</h2>
              <button className="modal__close" onClick={() => setShowBroadcastModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateBroadcast} className="modal__body">
              <div className="form-group">
                <label className="form-label">Nome do broadcast *</label>
                <input
                  className="form-input"
                  placeholder="Ex: Promoção de Natal"
                  value={broadcastForm.name}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Mensagem *</label>
                <textarea
                  className="form-input form-textarea"
                  placeholder="Digite a mensagem que será enviada para todos os destinatários..."
                  value={broadcastForm.message}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                  rows={4}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Lista de transmissão (opcional)</label>
                <select
                  className="form-select"
                  value={broadcastForm.listId}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, listId: e.target.value })}
                >
                  <option value="">Selecionar lista...</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>{l.name} ({l.phones.length} contatos)</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Números adicionais (um por linha ou separados por vírgula)</label>
                <textarea
                  className="form-input form-textarea"
                  placeholder="5511999999999&#10;5521888888888&#10;5531777777777"
                  value={broadcastForm.phones}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, phones: e.target.value })}
                  rows={4}
                />
                <span className="form-hint">
                  Formato: DDI + DDD + número, sem espaços ou sinais. Ex: 5511999999999
                </span>
              </div>
              <div className="form-group">
                <label className="form-label">Agendar envio (opcional)</label>
                <input
                  className="form-input"
                  type="datetime-local"
                  value={broadcastForm.scheduledAt}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, scheduledAt: e.target.value })}
                  min={new Date().toISOString().slice(0, 16)}
                />
                <span className="form-hint">
                  Deixe em branco para criar como rascunho e enviar manualmente
                </span>
              </div>
              <div className="modal__footer">
                <button type="button" className="btn-ghost" onClick={() => setShowBroadcastModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  <Megaphone size={15} /> Criar Broadcast
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── List Modal ── */}
      {showListModal && (
        <div className="modal-overlay" onClick={() => setShowListModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2>{editingList ? 'Editar Lista' : 'Nova Lista de Transmissão'}</h2>
              <button className="modal__close" onClick={() => setShowListModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveList} className="modal__body">
              <div className="form-group">
                <label className="form-label">Nome da lista *</label>
                <input
                  className="form-input"
                  placeholder="Ex: Clientes VIP"
                  value={listForm.name}
                  onChange={(e) => setListForm({ ...listForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Números (um por linha)</label>
                <textarea
                  className="form-input form-textarea"
                  placeholder="5511999999999&#10;5521888888888&#10;5531777777777"
                  value={listForm.phones}
                  onChange={(e) => setListForm({ ...listForm, phones: e.target.value })}
                  rows={8}
                />
                <span className="form-hint">
                  Formato: DDI + DDD + número. Ex: 5511999999999
                </span>
              </div>
              <div className="modal__footer">
                <button type="button" className="btn-ghost" onClick={() => setShowListModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {editingList ? 'Salvar' : 'Criar Lista'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
