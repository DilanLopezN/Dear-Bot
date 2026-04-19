import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { toast } from 'sonner';
import {
  Clock, Plus, Trash2, X, Loader2, CheckCircle2,
  XCircle, AlertCircle, Ban, CalendarClock,
} from 'lucide-react';
import './ScheduledMessagesPage.css';

type MsgStatus = 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED';

interface ScheduledMessage {
  id: string;
  phone: string;
  message: string;
  scheduledAt: string;
  status: MsgStatus;
  sentAt?: string;
  errorMessage?: string;
  contact?: { id: string; name: string; phone: string } | null;
}

interface Bot { id: string; name: string; }

const STATUS_LABELS: Record<MsgStatus, { label: string; className: string; icon: React.ElementType }> = {
  PENDING: { label: 'Pendente', className: 'badge--pending', icon: Clock },
  SENT: { label: 'Enviada', className: 'badge--sent', icon: CheckCircle2 },
  FAILED: { label: 'Falhou', className: 'badge--failed', icon: XCircle },
  CANCELLED: { label: 'Cancelada', className: 'badge--cancelled', icon: Ban },
};

export default function ScheduledMessagesPage() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState('');
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    phone: '',
    message: '',
    scheduledAt: '',
  });

  useEffect(() => {
    api.getBots().then((data) => {
      setBots(data);
      if (data.length > 0) setSelectedBotId(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (selectedBotId) loadMessages();
  }, [selectedBotId, filterStatus]);

  async function loadMessages() {
    setLoading(true);
    try {
      const data = await api.getScheduledMessages(selectedBotId, filterStatus || undefined);
      setMessages(data);
    } catch {
      toast.error('Erro ao carregar mensagens agendadas');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.createScheduledMessage(selectedBotId, {
        phone: form.phone.trim(),
        message: form.message.trim(),
        scheduledAt: new Date(form.scheduledAt).toISOString(),
      });
      toast.success('Mensagem agendada com sucesso!');
      setShowModal(false);
      setForm({ phone: '', message: '', scheduledAt: '' });
      loadMessages();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Erro ao agendar mensagem');
    }
  }

  async function handleCancel(id: string) {
    try {
      await api.cancelScheduledMessage(selectedBotId, id);
      toast.success('Mensagem cancelada');
      loadMessages();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Erro ao cancelar mensagem');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover esta mensagem agendada?')) return;
    try {
      await api.deleteScheduledMessage(selectedBotId, id);
      toast.success('Mensagem removida');
      loadMessages();
    } catch {
      toast.error('Erro ao remover mensagem');
    }
  }

  // Default datetime-local value (now + 1h)
  function defaultScheduledAt() {
    const d = new Date(Date.now() + 3600_000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function openModal() {
    setForm({ phone: '', message: '', scheduledAt: defaultScheduledAt() });
    setShowModal(true);
  }

  return (
    <div className="scheduled-page">
      <div className="scheduled-page__header">
        <div className="scheduled-page__title-row">
          <div className="scheduled-page__title-left">
            <div className="scheduled-page__icon-wrap">
              <CalendarClock size={20} />
            </div>
            <div>
              <h1 className="scheduled-page__title">Agendamento de Mensagens</h1>
              <p className="scheduled-page__subtitle">
                Programe envios automáticos para qualquer número
              </p>
            </div>
          </div>
          <button className="btn btn-primary" onClick={openModal}>
            <Plus size={16} /> Agendar Mensagem
          </button>
        </div>

        <div className="scheduled-page__filters">
          <select
            className="form-select"
            value={selectedBotId}
            onChange={(e) => setSelectedBotId(e.target.value)}
          >
            {bots.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select
            className="form-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="PENDING">Pendentes</option>
            <option value="SENT">Enviadas</option>
            <option value="FAILED">Com falha</option>
            <option value="CANCELLED">Canceladas</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="scheduled-page__loading">
          <Loader2 size={24} className="spin" />
          <span>Carregando...</span>
        </div>
      ) : messages.length === 0 ? (
        <div className="scheduled-page__empty">
          <CalendarClock size={40} opacity={0.3} />
          <p>Nenhuma mensagem agendada</p>
          <span>Clique em "Agendar Mensagem" para criar um novo agendamento</span>
        </div>
      ) : (
        <div className="scheduled-page__list">
          {messages.map((msg) => {
            const statusInfo = STATUS_LABELS[msg.status];
            const StatusIcon = statusInfo.icon;
            return (
              <div key={msg.id} className="scheduled-card">
                <div className="scheduled-card__left">
                  <div className={`scheduled-card__status-icon scheduled-card__status-icon--${msg.status.toLowerCase()}`}>
                    <StatusIcon size={16} />
                  </div>
                  <div className="scheduled-card__info">
                    <div className="scheduled-card__phone">
                      {msg.contact?.name
                        ? `${msg.contact.name} (${msg.phone})`
                        : msg.phone}
                    </div>
                    <div className="scheduled-card__message">{msg.message}</div>
                    <div className="scheduled-card__meta">
                      <Clock size={12} />
                      <span>Agendado para {new Date(msg.scheduledAt).toLocaleString('pt-BR')}</span>
                      {msg.sentAt && (
                        <span> · Enviado em {new Date(msg.sentAt).toLocaleString('pt-BR')}</span>
                      )}
                    </div>
                    {msg.errorMessage && (
                      <div className="scheduled-card__error">
                        <AlertCircle size={12} /> {msg.errorMessage}
                      </div>
                    )}
                  </div>
                </div>
                <div className="scheduled-card__right">
                  <span className={`badge ${statusInfo.className}`}>
                    <StatusIcon size={11} /> {statusInfo.label}
                  </span>
                  <div className="scheduled-card__actions">
                    {msg.status === 'PENDING' && (
                      <button className="icon-btn icon-btn--warn" onClick={() => handleCancel(msg.id)} title="Cancelar">
                        <Ban size={14} />
                      </button>
                    )}
                    <button className="icon-btn icon-btn--danger" onClick={() => handleDelete(msg.id)} title="Excluir">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2>Agendar Mensagem</h2>
              <button className="modal__close" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="modal__body">
              <div className="form-group">
                <label className="form-label">Telefone de destino *</label>
                <input
                  className="form-input"
                  placeholder="Ex: 5511999999999"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  required
                />
                <span className="form-hint">Formato internacional sem + (DDI + DDD + número)</span>
              </div>
              <div className="form-group">
                <label className="form-label">Mensagem *</label>
                <textarea
                  className="form-input form-textarea"
                  placeholder="Digite a mensagem a ser enviada..."
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  rows={4}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Data e hora do envio *</label>
                <input
                  className="form-input"
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                  min={new Date().toISOString().slice(0, 16)}
                  required
                />
              </div>
              <div className="modal__footer">
                <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  <CalendarClock size={15} /> Agendar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
