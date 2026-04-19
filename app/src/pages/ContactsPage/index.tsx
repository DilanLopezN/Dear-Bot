import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { toast } from 'sonner';
import {
  Users, Plus, Trash2, Pencil, X, Search, Tag,
  Phone, Mail, StickyNote, Loader2,
} from 'lucide-react';
import './ContactsPage.css';

interface Contact {
  id: string;
  botId: string;
  phone: string;
  name?: string;
  email?: string;
  tags: string[];
  notes?: string;
  createdAt: string;
}

interface Bot {
  id: string;
  name: string;
}

export default function ContactsPage() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string>('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  const [form, setForm] = useState({
    phone: '',
    name: '',
    email: '',
    tags: '',
    notes: '',
  });

  useEffect(() => {
    api.getBots().then((data) => {
      setBots(data);
      if (data.length > 0) setSelectedBotId(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (selectedBotId) loadContacts();
  }, [selectedBotId, search]);

  async function loadContacts() {
    setLoading(true);
    try {
      const data = await api.getContacts(selectedBotId, search || undefined);
      setContacts(data);
    } catch {
      toast.error('Erro ao carregar contatos');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingContact(null);
    setForm({ phone: '', name: '', email: '', tags: '', notes: '' });
    setShowModal(true);
  }

  function openEdit(c: Contact) {
    setEditingContact(c);
    setForm({
      phone: c.phone,
      name: c.name ?? '',
      email: c.email ?? '',
      tags: c.tags.join(', '),
      notes: c.notes ?? '',
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      phone: form.phone.trim(),
      name: form.name.trim() || undefined,
      email: form.email.trim() || undefined,
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      notes: form.notes.trim() || undefined,
    };
    try {
      if (editingContact) {
        await api.updateContact(selectedBotId, editingContact.id, payload);
        toast.success('Contato atualizado');
      } else {
        await api.createContact(selectedBotId, payload);
        toast.success('Contato criado');
      }
      setShowModal(false);
      loadContacts();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Erro ao salvar contato');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este contato?')) return;
    try {
      await api.deleteContact(selectedBotId, id);
      toast.success('Contato removido');
      loadContacts();
    } catch {
      toast.error('Erro ao remover contato');
    }
  }

  const filteredContacts = contacts;

  return (
    <div className="contacts-page">
      <div className="contacts-page__header">
        <div className="contacts-page__title-row">
          <div className="contacts-page__title-left">
            <div className="contacts-page__icon-wrap">
              <Users size={20} />
            </div>
            <div>
              <h1 className="contacts-page__title">Contatos</h1>
              <p className="contacts-page__subtitle">
                Gerencie os contatos salvos automaticamente pelo bot
              </p>
            </div>
          </div>
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} /> Novo Contato
          </button>
        </div>

        <div className="contacts-page__filters">
          <select
            className="form-select"
            value={selectedBotId}
            onChange={(e) => setSelectedBotId(e.target.value)}
          >
            {bots.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <div className="contacts-page__search-wrap">
            <Search size={14} className="contacts-page__search-icon" />
            <input
              className="form-input contacts-page__search"
              placeholder="Buscar por nome, telefone ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="contacts-page__loading">
          <Loader2 size={24} className="spin" />
          <span>Carregando contatos...</span>
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="contacts-page__empty">
          <Users size={40} opacity={0.3} />
          <p>Nenhum contato encontrado</p>
          <span>Os contatos são salvos automaticamente quando alguém conversa com o bot</span>
        </div>
      ) : (
        <div className="contacts-page__grid">
          {filteredContacts.map((contact) => (
            <div key={contact.id} className="contact-card">
              <div className="contact-card__header">
                <div className="contact-card__avatar">
                  {(contact.name ?? contact.phone)[0].toUpperCase()}
                </div>
                <div className="contact-card__info">
                  <strong>{contact.name ?? 'Sem nome'}</strong>
                  <span className="contact-card__phone">
                    <Phone size={12} /> {contact.phone}
                  </span>
                  {contact.email && (
                    <span className="contact-card__email">
                      <Mail size={12} /> {contact.email}
                    </span>
                  )}
                </div>
                <div className="contact-card__actions">
                  <button className="icon-btn" onClick={() => openEdit(contact)} title="Editar">
                    <Pencil size={14} />
                  </button>
                  <button className="icon-btn icon-btn--danger" onClick={() => handleDelete(contact.id)} title="Excluir">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {contact.tags.length > 0 && (
                <div className="contact-card__tags">
                  <Tag size={12} />
                  {contact.tags.map((tag) => (
                    <span key={tag} className="contact-card__tag">{tag}</span>
                  ))}
                </div>
              )}
              {contact.notes && (
                <div className="contact-card__notes">
                  <StickyNote size={12} />
                  <span>{contact.notes}</span>
                </div>
              )}
              <div className="contact-card__date">
                Adicionado em {new Date(contact.createdAt).toLocaleDateString('pt-BR')}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2>{editingContact ? 'Editar Contato' : 'Novo Contato'}</h2>
              <button className="modal__close" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal__body">
              <div className="form-group">
                <label className="form-label">Telefone *</label>
                <input
                  className="form-input"
                  placeholder="Ex: 5511999999999"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Nome</label>
                <input
                  className="form-input"
                  placeholder="Nome do contato"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  className="form-input"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tags (separadas por vírgula)</label>
                <input
                  className="form-input"
                  placeholder="cliente, vip, lead"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Observações</label>
                <textarea
                  className="form-input form-textarea"
                  placeholder="Anotações sobre o contato..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="modal__footer">
                <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {editingContact ? 'Salvar' : 'Criar Contato'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
