import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useBotStore, type Bot } from '@/stores/bot.store';
import { api } from '@/services/api';
import {
  Plus, Trash2, Pencil, Zap, Key, X, Power, PowerOff,
  MessageSquare, Bot as BotIcon, Phone, Loader2, ChevronRight,
} from 'lucide-react';

// ─── Modal wrapper ───
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>{title}</h2>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Input helper ───
function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 block">{label}</label>
      {children}
      {error && <span className="text-xs text-red-400 mt-1 block">{error}</span>}
    </div>
  );
}

const inputClass = "w-full px-3 py-2.5 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-all";
const btnPrimary = "px-4 py-2 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-medium transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50";
const btnDanger = "px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm transition-all cursor-pointer flex items-center gap-1.5";

// ─── Create/Edit Bot Modal ───
function BotFormModal({ open, onClose, bot }: { open: boolean; onClose: () => void; bot?: Bot | null }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: { name: bot?.name || '', responseMode: bot?.responseMode || 'KEYWORDS', systemPrompt: bot?.systemPrompt || '' },
  });
  const { createBot, updateBot } = useBotStore();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    reset({ name: bot?.name || '', responseMode: bot?.responseMode || 'KEYWORDS', systemPrompt: bot?.systemPrompt || '' });
  }, [bot, reset]);

  const onSubmit = async (data: any) => {
    setSaving(true);
    try {
      if (bot) await updateBot(bot.id, data);
      else await createBot(data);
      onClose();
    } catch {} finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={bot ? 'Editar Bot' : 'Novo Bot'}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FormField label="Nome" error={errors.name?.message}>
          <input {...register('name', { required: 'Nome obrigatório' })} placeholder="Meu bot" className={inputClass} />
        </FormField>
        <FormField label="Modo de resposta">
          <select {...register('responseMode')} className={inputClass}>
            <option value="KEYWORDS">Keywords</option>
            <option value="AI">IA (Claude)</option>
            <option value="HYBRID">Híbrido</option>
          </select>
        </FormField>
        <FormField label="System Prompt (IA)">
          <textarea {...register('systemPrompt')} placeholder="Instruções para a IA..." rows={3} className={inputClass + ' resize-none'} />
        </FormField>
        <div className="flex justify-end gap-3 mt-6">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all cursor-pointer">Cancelar</button>
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {bot ? 'Salvar' : 'Criar Bot'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Keywords Modal ───
function KeywordsModal({ open, onClose, bot }: { open: boolean; onClose: () => void; bot: Bot }) {
  const [keywords, setKeywords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { register, handleSubmit, reset } = useForm({ defaultValues: { trigger: '', response: '', priority: 0 } });

  const load = async () => {
    setLoading(true);
    try { setKeywords(await api.getKeywords(bot.id)); } catch {} finally { setLoading(false); }
  };
  useEffect(() => { if (open) load(); }, [open]);

  const onAdd = async (data: any) => {
    await api.createKeyword(bot.id, { ...data, priority: Number(data.priority) || 0 });
    reset();
    load();
  };

  const onDelete = async (kwId: string) => {
    await api.deleteKeyword(bot.id, kwId);
    load();
  };

  return (
    <Modal open={open} onClose={onClose} title={`Keywords - ${bot.name}`}>
      <form onSubmit={handleSubmit(onAdd)} className="flex gap-2 mb-4">
        <input {...register('trigger', { required: true })} placeholder="Trigger" className={inputClass + ' flex-1'} />
        <input {...register('response', { required: true })} placeholder="Resposta" className={inputClass + ' flex-1'} />
        <button type="submit" className="px-3 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm cursor-pointer shrink-0"><Plus className="w-4 h-4" /></button>
      </form>
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {loading ? <p className="text-sm text-[var(--color-text-muted)]">Carregando...</p> :
          keywords.length === 0 ? <p className="text-sm text-[var(--color-text-muted)]">Nenhuma keyword.</p> :
          keywords.map((kw) => (
            <div key={kw.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-tertiary)]">
              <div>
                <span className="text-sm font-medium text-[var(--color-accent-hover)]">{kw.trigger}</span>
                <span className="text-xs text-[var(--color-text-muted)] ml-2">→ {kw.response.slice(0, 50)}</span>
              </div>
              <button onClick={() => onDelete(kw.id)} className="text-red-400 hover:text-red-300 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))
        }
      </div>
    </Modal>
  );
}

// ─── WhatsApp Modal ───
function WhatsAppModal({ open, onClose, bot }: { open: boolean; onClose: () => void; bot: Bot }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { phoneNumber: '', dialog360ApiKey: '' },
  });
  const [saving, setSaving] = useState(false);
  const { fetchBots } = useBotStore();
  const hasChannel = !!bot.whatsappChannel;

  const onSubmit = async (data: any) => {
    setSaving(true);
    try {
      await api.createWhatsappChannel(bot.id, data);
      await fetchBots();
      onClose();
    } catch {} finally { setSaving(false); }
  };

  const onDisconnect = async () => {
    await api.deleteWhatsappChannel(bot.id);
    await fetchBots();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={`WhatsApp - ${bot.name}`}>
      {hasChannel ? (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-2 text-green-400 text-sm font-medium mb-1">
              <Zap className="w-4 h-4" /> Conectado
            </div>
            <p className="text-xs text-[var(--color-text-secondary)]">{bot.whatsappChannel?.phoneNumber}</p>
          </div>
          <button onClick={onDisconnect} className={btnDanger + ' w-full justify-center'}>
            <Trash2 className="w-4 h-4" /> Desconectar WhatsApp
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)}>
          <FormField label="Número WhatsApp" error={errors.phoneNumber?.message}>
            <input {...register('phoneNumber', { required: 'Obrigatório' })} placeholder="+5511999999999" className={inputClass} />
          </FormField>
          <FormField label="Dialog360 API Key" error={errors.dialog360ApiKey?.message}>
            <input {...register('dialog360ApiKey', { required: 'Obrigatório' })} placeholder="Sua API Key" className={inputClass} />
          </FormField>
          <button type="submit" disabled={saving} className={btnPrimary + ' w-full justify-center mt-2'}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Conectar WhatsApp
          </button>
        </form>
      )}
    </Modal>
  );
}

// ─── Main Page ───
export default function BotsPage() {
  const { bots, fetchBots, deleteBot, updateBot, loading } = useBotStore();
  const [showForm, setShowForm] = useState(false);
  const [editBot, setEditBot] = useState<Bot | null>(null);
  const [kwBot, setKwBot] = useState<Bot | null>(null);
  const [waBot, setWaBot] = useState<Bot | null>(null);

  useEffect(() => { fetchBots(); }, [fetchBots]);

  const toggleActive = async (bot: Bot) => {
    await updateBot(bot.id, { isActive: !bot.isActive });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>Bots</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">Gerencie seus chatbots</p>
        </div>
        <button onClick={() => { setEditBot(null); setShowForm(true); }} className={btnPrimary}>
          <Plus className="w-4 h-4" /> Novo Bot
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-[var(--color-text-muted)]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
        </div>
      ) : bots.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-60 text-center">
          <BotIcon className="w-12 h-12 text-[var(--color-text-muted)] mb-3" />
          <p className="text-[var(--color-text-secondary)]">Nenhum bot criado</p>
          <p className="text-sm text-[var(--color-text-muted)]">Crie seu primeiro chatbot clicando no botão acima</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {bots.map((bot) => (
            <div key={bot.id} className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-5 hover:border-[var(--color-border-light)] transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${bot.isActive ? 'bg-green-400 shadow-sm shadow-green-400/50' : 'bg-[var(--color-text-muted)]'}`} />
                  <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{bot.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-accent-glow)] text-[var(--color-accent-hover)] font-medium">
                    {bot.responseMode}
                  </span>
                  {bot.whatsappChannel && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 flex items-center gap-1">
                      <Zap className="w-3 h-3" /> {bot.whatsappChannel.phoneNumber}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button onClick={() => toggleActive(bot)} className="p-2 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-all cursor-pointer" title={bot.isActive ? 'Desativar' : 'Ativar'}>
                    {bot.isActive ? <Power className="w-4 h-4 text-green-400" /> : <PowerOff className="w-4 h-4" />}
                  </button>
                  <button onClick={() => setKwBot(bot)} className="p-2 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-all cursor-pointer" title="Keywords">
                    <Key className="w-4 h-4" />
                  </button>
                  <button onClick={() => setWaBot(bot)} className="p-2 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-all cursor-pointer" title="WhatsApp">
                    <Phone className="w-4 h-4" />
                  </button>
                  <button onClick={() => { setEditBot(bot); setShowForm(true); }} className="p-2 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-all cursor-pointer" title="Editar">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteBot(bot.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-[var(--color-text-muted)] hover:text-red-400 transition-all cursor-pointer" title="Excluir">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-5 mt-3 text-xs text-[var(--color-text-muted)]">
                <span className="flex items-center gap-1"><Key className="w-3 h-3" /> {bot._count?.keywords || 0} keywords</span>
                <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {bot._count?.conversations || 0} conversas</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <BotFormModal open={showForm} onClose={() => setShowForm(false)} bot={editBot} />
      {kwBot && <KeywordsModal open={!!kwBot} onClose={() => setKwBot(null)} bot={kwBot} />}
      {waBot && <WhatsAppModal open={!!waBot} onClose={() => setWaBot(null)} bot={waBot} />}
    </div>
  );
}
