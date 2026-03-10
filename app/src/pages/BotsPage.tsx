import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useBotStore, type Bot } from '@/stores/bot.store';
import { api, type InteractiveMenu, type MenuOption } from '@/services/api';
import {
  Plus, Trash2, Pencil, Zap, Key, X, Power, PowerOff,
  MessageSquare, Bot as BotIcon, Phone, Loader2, Send,
  Play, ArrowLeft, Check, CheckCheck, List, Cpu,
} from 'lucide-react';

// ─── Shared styles ───
const inputClass = "w-full px-4 py-3 rounded-xl bg-[var(--color-bg-input)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-all";
const btnPrimary = "px-6 py-3 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-medium transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50";
const btnDanger = "px-5 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm transition-all cursor-pointer flex items-center gap-2";
const btnSecondary = "px-5 py-3 rounded-xl text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-all cursor-pointer";

// ─── Modal wrapper ───
function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className={`bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl w-full shadow-2xl ${wide ? 'max-w-2xl' : 'max-w-md'}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-7 py-5 border-b border-[var(--color-border)]">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>{title}</h2>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer p-1"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-7">{children}</div>
      </div>
    </div>
  );
}

// ─── Input helper ───
function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <label className="text-sm font-medium text-[var(--color-text-secondary)] mb-2 block">{label}</label>
      {children}
      {error && <span className="text-xs text-red-400 mt-1.5 block">{error}</span>}
    </div>
  );
}

// ─── Create/Edit Bot Modal ───
function BotFormModal({ open, onClose, bot }: { open: boolean; onClose: () => void; bot?: Bot | null }) {
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({
    defaultValues: { name: bot?.name || '', responseMode: bot?.responseMode || 'KEYWORDS', systemPrompt: bot?.systemPrompt || '', aiConfigId: bot?.aiConfigId || '' },
  });
  const { createBot, updateBot } = useBotStore();
  const [saving, setSaving] = useState(false);
  const [aiConfigs, setAiConfigs] = useState<any[]>([]);
  const responseMode = watch('responseMode');

  useEffect(() => {
    reset({ name: bot?.name || '', responseMode: bot?.responseMode || 'KEYWORDS', systemPrompt: bot?.systemPrompt || '', aiConfigId: bot?.aiConfigId || '' });
  }, [bot, reset]);

  useEffect(() => {
    if (open) {
      api.getAiConfigs().then(setAiConfigs).catch(() => setAiConfigs([]));
    }
  }, [open]);

  const onSubmit = async (data: any) => {
    setSaving(true);
    try {
      const payload = { ...data, aiConfigId: data.aiConfigId || null };
      if (bot) await updateBot(bot.id, payload);
      else await createBot(payload);
      onClose();
    } catch {} finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={bot ? 'Editar Bot' : 'Novo Bot'}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FormField label="Nome do Bot" error={errors.name?.message}>
          <input {...register('name', { required: 'Nome obrigatório' })} placeholder="Ex: Atendimento" className={inputClass} />
        </FormField>
        <FormField label="Modo de resposta">
          <select {...register('responseMode')} className={inputClass}>
            <option value="KEYWORDS">Keywords</option>
            <option value="AI">I.A.</option>
            <option value="HYBRID">Híbrido</option>
          </select>
        </FormField>
        {(responseMode === 'AI' || responseMode === 'HYBRID') && (
          <FormField label="Configuração de I.A.">
            <select {...register('aiConfigId')} className={inputClass}>
              <option value="">Claude (padrão do ambiente)</option>
              {aiConfigs.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.provider} - {c.model})
                </option>
              ))}
            </select>
            <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
              Configure provedores em Configuração I.A. no menu lateral
            </p>
          </FormField>
        )}
        <FormField label="System Prompt (IA)">
          <textarea {...register('systemPrompt')} placeholder="Instruções para a IA..." rows={4} className={inputClass + ' resize-none'} />
        </FormField>
        <div className="flex justify-end gap-3 mt-7">
          <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
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
    <Modal open={open} onClose={onClose} title={`Keywords - ${bot.name}`} wide>
      <p className="text-xs text-[var(--color-text-muted)] mb-5">O matching de keywords é case-insensitive (maiúsculas/minúsculas não importam).</p>
      <form onSubmit={handleSubmit(onAdd)} className="flex flex-col sm:flex-row gap-3 mb-6">
        <input {...register('trigger', { required: true })} placeholder="Palavra-chave" className={inputClass + ' flex-1'} />
        <input {...register('response', { required: true })} placeholder="Resposta do bot" className={inputClass + ' flex-1'} />
        <button type="submit" className={btnPrimary + ' shrink-0 justify-center'}>
          <Plus className="w-4 h-4" /> Adicionar
        </button>
      </form>
      <div className="space-y-2.5 max-h-[350px] overflow-y-auto">
        {loading ? <p className="text-sm text-[var(--color-text-muted)]">Carregando...</p> :
          keywords.length === 0 ? <p className="text-sm text-[var(--color-text-muted)] text-center py-8">Nenhuma keyword cadastrada.</p> :
          keywords.map((kw) => (
            <div key={kw.id} className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-bg-tertiary)]">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-sm font-semibold text-[var(--color-accent)] shrink-0">{kw.trigger}</span>
                <span className="text-[var(--color-text-muted)] shrink-0">→</span>
                <span className="text-sm text-[var(--color-text-secondary)] truncate">{kw.response}</span>
              </div>
              <button onClick={() => onDelete(kw.id)} className="text-red-400 hover:text-red-300 cursor-pointer ml-3 p-2 rounded-lg hover:bg-red-500/10 transition-all"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))
        }
      </div>
    </Modal>
  );
}

// ─── Interactive Menus Modal ───
function MenusModal({ open, onClose, bot }: { open: boolean; onClose: () => void; bot: Bot }) {
  const [menus, setMenus] = useState<InteractiveMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const { register, handleSubmit, reset, setValue } = useForm({
    defaultValues: { trigger: '', title: '', body: '', footer: '' },
  });
  const [options, setOptions] = useState<MenuOption[]>([]);
  const [optTitle, setOptTitle] = useState('');
  const [optDesc, setOptDesc] = useState('');

  const load = async () => {
    setLoading(true);
    try { setMenus(await api.getMenus(bot.id)); } catch {} finally { setLoading(false); }
  };
  useEffect(() => { if (open) load(); }, [open]);

  const addOption = () => {
    if (!optTitle.trim()) return;
    setOptions([...options, { id: `opt_${Date.now()}`, title: optTitle.trim(), description: optDesc.trim() || undefined }]);
    setOptTitle('');
    setOptDesc('');
  };

  const removeOption = (id: string) => setOptions(options.filter((o) => o.id !== id));

  const onAdd = async (data: any) => {
    if (options.length === 0) return;
    await api.createMenu(bot.id, {
      trigger: data.trigger,
      title: data.title,
      body: data.body || undefined,
      footer: data.footer || undefined,
      options,
    });
    reset();
    setOptions([]);
    setShowAdd(false);
    load();
  };

  const onDeleteMenu = async (menuId: string) => {
    await api.deleteMenu(bot.id, menuId);
    load();
  };

  return (
    <Modal open={open} onClose={onClose} title={`Menus Interativos - ${bot.name}`} wide>
      {showAdd ? (
        <form onSubmit={handleSubmit(onAdd)}>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <FormField label="Trigger (palavra-chave)">
              <input {...register('trigger', { required: true })} placeholder="Ex: menu, opções" className={inputClass} />
            </FormField>
            <FormField label="Título do menu">
              <input {...register('title', { required: true })} placeholder="Ex: Menu Principal" className={inputClass} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <FormField label="Corpo (descrição)">
              <input {...register('body')} placeholder="Escolha uma opção abaixo" className={inputClass} />
            </FormField>
            <FormField label="Rodapé (opcional)">
              <input {...register('footer')} placeholder="Responda com o número" className={inputClass} />
            </FormField>
          </div>

          <div className="mb-4">
            <label className="text-sm font-medium text-[var(--color-text-secondary)] mb-2 block">Opções do menu</label>
            <div className="flex gap-3 mb-3">
              <input value={optTitle} onChange={(e) => setOptTitle(e.target.value)} placeholder="Título da opção" className={inputClass + ' flex-1'} />
              <input value={optDesc} onChange={(e) => setOptDesc(e.target.value)} placeholder="Descrição (opcional)" className={inputClass + ' flex-1'} />
              <button type="button" onClick={addOption} className={btnPrimary + ' shrink-0'}><Plus className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {options.map((opt, i) => (
                <div key={opt.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-tertiary)]">
                  <span className="text-sm text-[var(--color-text-primary)]">
                    <strong className="text-[var(--color-accent)]">{i + 1}.</strong> {opt.title}
                    {opt.description && <span className="text-[var(--color-text-muted)] ml-2">- {opt.description}</span>}
                  </span>
                  <button type="button" onClick={() => removeOption(opt.id)} className="text-red-400 hover:text-red-300 p-1 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              {options.length === 0 && <p className="text-xs text-[var(--color-text-muted)] text-center py-4">Adicione pelo menos uma opção ao menu</p>}
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={() => { setShowAdd(false); reset(); setOptions([]); }} className={btnSecondary}>Cancelar</button>
            <button type="submit" disabled={options.length === 0} className={btnPrimary}>Criar Menu</button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex justify-end mb-5">
            <button onClick={() => setShowAdd(true)} className={btnPrimary}><Plus className="w-4 h-4" /> Novo Menu</button>
          </div>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {loading ? <p className="text-sm text-[var(--color-text-muted)]">Carregando...</p> :
              menus.length === 0 ? <p className="text-sm text-[var(--color-text-muted)] text-center py-8">Nenhum menu interativo criado.</p> :
              menus.map((menu) => (
                <div key={menu.id} className="p-4 rounded-xl bg-[var(--color-bg-tertiary)]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-accent-glow)] text-[var(--color-accent)] font-medium">{menu.trigger}</span>
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">{menu.title}</span>
                    </div>
                    <button onClick={() => onDeleteMenu(menu.id)} className="text-red-400 hover:text-red-300 cursor-pointer p-2 rounded-lg hover:bg-red-500/10 transition-all"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="space-y-1.5">
                    {(menu.options || []).map((opt, i) => (
                      <div key={opt.id} className="text-xs text-[var(--color-text-secondary)] pl-3">
                        <span className="text-[var(--color-accent)]">{i + 1}.</span> {opt.title}
                        {opt.description && <span className="text-[var(--color-text-muted)]"> - {opt.description}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            }
          </div>
        </>
      )}
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
        <div className="space-y-5">
          <div className="p-5 rounded-xl bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-2 text-green-400 text-sm font-medium mb-2">
              <Zap className="w-4 h-4" /> Conectado
            </div>
            <p className="text-sm text-[var(--color-text-secondary)]">{bot.whatsappChannel?.phoneNumber}</p>
          </div>
          <button onClick={onDisconnect} className={btnDanger + ' w-full justify-center'}>
            <Trash2 className="w-4 h-4" /> Desconectar WhatsApp
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)}>
          <FormField label="Número WhatsApp" error={errors.phoneNumber?.message}>
            <div className="relative">
              <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center pointer-events-none">
                <Phone className="w-[18px] h-[18px] text-[var(--color-text-muted)]" />
              </div>
              <input {...register('phoneNumber', { required: 'Obrigatório' })} placeholder="+5511999999999" className={inputClass + ' !pl-12'} />
            </div>
          </FormField>
          <FormField label="Dialog360 API Key" error={errors.dialog360ApiKey?.message}>
            <div className="relative">
              <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center pointer-events-none">
                <Key className="w-[18px] h-[18px] text-[var(--color-text-muted)]" />
              </div>
              <input {...register('dialog360ApiKey', { required: 'Obrigatório' })} placeholder="Sua API Key" className={inputClass + ' !pl-12'} />
            </div>
          </FormField>
          <button type="submit" disabled={saving} className={btnPrimary + ' w-full justify-center mt-4'}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Conectar WhatsApp
          </button>
        </form>
      )}
    </Modal>
  );
}

// ─── WhatsApp Emulator ───
interface EmulatorMessage {
  id: string;
  text: string;
  direction: 'incoming' | 'outgoing';
  time: string;
  status?: 'sent' | 'delivered' | 'read';
  isMenu?: boolean;
  menuOptions?: MenuOption[];
}

function WhatsAppEmulator({ open, onClose, bot }: { open: boolean; onClose: () => void; bot: Bot }) {
  const [messages, setMessages] = useState<EmulatorMessage[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [keywords, setKeywords] = useState<any[]>([]);
  const [menus, setMenus] = useState<InteractiveMenu[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setMessages([]);
      setInput('');
      api.getKeywords(bot.id).then(setKeywords).catch(() => setKeywords([]));
      api.getMenus(bot.id).then(setMenus).catch(() => setMenus([]));
    }
  }, [open, bot.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const now = () => {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const findMenuMatch = (text: string): InteractiveMenu | null => {
    const normalized = text.toLowerCase().trim();
    for (const menu of menus) {
      if (menu.isActive !== false && normalized.includes(menu.trigger.toLowerCase())) {
        return menu;
      }
    }
    return null;
  };

  const findKeywordMatch = (text: string): string | null => {
    const normalized = text.toLowerCase().trim();
    const sorted = [...keywords].sort((a, b) => (b.priority || 0) - (a.priority || 0));
    for (const kw of sorted) {
      if (kw.isActive !== false && normalized.includes(kw.trigger.toLowerCase())) {
        return kw.response;
      }
    }
    return null;
  };

  const generateAIResponse = (text: string): string => {
    const lower = text.toLowerCase();
    if (lower.includes('olá') || lower.includes('oi') || lower.includes('hey') || lower.includes('bom dia') || lower.includes('boa tarde') || lower.includes('boa noite')) {
      return `Olá! Sou o assistente ${bot.name}. Como posso ajudar você hoje?`;
    }
    if (lower.includes('preço') || lower.includes('valor') || lower.includes('custo') || lower.includes('quanto')) {
      return 'Para informações sobre preços e valores, por favor entre em contato com nossa equipe comercial. Posso ajudar com algo mais?';
    }
    if (lower.includes('obrigado') || lower.includes('valeu') || lower.includes('agradeço')) {
      return 'Por nada! Fico feliz em ajudar. Se precisar de mais alguma coisa, é só falar!';
    }
    return `Entendi sua mensagem. Sou o assistente ${bot.name} e estou aqui para ajudar. Pode me contar mais detalhes sobre o que precisa?`;
  };

  const sendMessage = async (text?: string) => {
    const msgText = text || input.trim();
    if (!msgText) return;
    if (!text) setInput('');

    const userMsg: EmulatorMessage = {
      id: Date.now().toString(),
      text: msgText,
      direction: 'outgoing',
      time: now(),
      status: 'sent',
    };
    setMessages((prev) => [...prev, userMsg]);

    setTimeout(() => {
      setMessages((prev) => prev.map((m) => (m.id === userMsg.id ? { ...m, status: 'delivered' as const } : m)));
    }, 500);
    setTimeout(() => {
      setMessages((prev) => prev.map((m) => (m.id === userMsg.id ? { ...m, status: 'read' as const } : m)));
    }, 1000);

    setTyping(true);
    const delay = 800 + Math.random() * 1200;

    setTimeout(() => {
      setTyping(false);

      // Check menus first
      const menuMatch = findMenuMatch(msgText);
      if (menuMatch) {
        const botMsg: EmulatorMessage = {
          id: (Date.now() + 1).toString(),
          text: `📋 ${menuMatch.title}\n${menuMatch.body || ''}\n\n${(menuMatch.options || []).map((o, i) => `${i + 1}. ${o.title}${o.description ? ' - ' + o.description : ''}`).join('\n')}${menuMatch.footer ? '\n\n' + menuMatch.footer : ''}`,
          direction: 'incoming',
          time: now(),
          isMenu: true,
          menuOptions: menuMatch.options,
        };
        setMessages((prev) => [...prev, botMsg]);
        return;
      }

      let response: string;
      if (bot.responseMode === 'KEYWORDS' || bot.responseMode === 'HYBRID') {
        const match = findKeywordMatch(msgText);
        if (match) {
          response = match;
        } else if (bot.responseMode === 'HYBRID') {
          response = generateAIResponse(msgText);
        } else {
          response = 'Desculpe, não entendi. Tente reformular sua pergunta.';
        }
      } else {
        response = generateAIResponse(msgText);
      }

      const botMsg: EmulatorMessage = {
        id: (Date.now() + 1).toString(),
        text: response,
        direction: 'incoming',
        time: now(),
      };
      setMessages((prev) => [...prev, botMsg]);
    }, delay);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-[420px] h-[680px] flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-[var(--color-border)]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-[#1f2c34] px-4 py-3 flex items-center gap-3 shrink-0">
          <button onClick={onClose} className="text-[#aebac1] hover:text-white cursor-pointer p-1">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-full bg-[#6b7b8d] flex items-center justify-center">
            <BotIcon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#e9edef] truncate">{bot.name}</p>
            <p className="text-xs text-[#8696a0]">{typing ? 'digitando...' : 'online'}</p>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#005c4b] text-[#25d366] font-medium">{bot.responseMode}</span>
        </div>

        {/* Chat area */}
        <div className="flex-1 whatsapp-chat-bg overflow-y-auto px-3 py-4 space-y-1.5">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="w-16 h-16 rounded-full bg-[#202c33] flex items-center justify-center mb-4">
                <MessageSquare className="w-7 h-7 text-[#8696a0]" />
              </div>
              <p className="text-[#8696a0] text-sm mb-1">Emulador WhatsApp</p>
              <p className="text-[#667781] text-xs">Envie uma mensagem para simular uma conversa com o bot <strong className="text-[#8696a0]">{bot.name}</strong></p>
              <div className="flex gap-2 mt-3">
                {bot.responseMode !== 'AI' && (
                  <span className="text-[#667781] text-[11px] bg-[#202c33] px-3 py-1.5 rounded-lg">
                    {keywords.length} keyword{keywords.length !== 1 ? 's' : ''}
                  </span>
                )}
                <span className="text-[#667781] text-[11px] bg-[#202c33] px-3 py-1.5 rounded-lg">
                  {menus.length} menu{menus.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-3 py-2 text-[13px] leading-relaxed ${msg.direction === 'outgoing' ? 'whatsapp-bubble-outgoing text-[#e9edef]' : 'whatsapp-bubble-incoming text-[#e9edef]'}`}>
                <span className="whitespace-pre-wrap">{msg.text}</span>
                {/* Interactive menu buttons */}
                {msg.isMenu && msg.menuOptions && (
                  <div className="mt-2 space-y-1.5">
                    {msg.menuOptions.map((opt, i) => (
                      <button
                        key={opt.id}
                        onClick={() => sendMessage(opt.title)}
                        className="w-full text-left px-3 py-2 rounded-lg bg-[#005c4b]/40 hover:bg-[#005c4b]/70 text-[#25d366] text-xs font-medium transition-colors cursor-pointer border border-[#25d366]/20"
                      >
                        {opt.title}
                      </button>
                    ))}
                  </div>
                )}
                <span className="flex items-center justify-end gap-1 mt-0.5">
                  <span className="text-[10px] text-[#8696a0]">{msg.time}</span>
                  {msg.direction === 'outgoing' && (
                    msg.status === 'read'
                      ? <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                      : msg.status === 'delivered'
                      ? <CheckCheck className="w-3.5 h-3.5 text-[#8696a0]" />
                      : <Check className="w-3.5 h-3.5 text-[#8696a0]" />
                  )}
                </span>
              </div>
            </div>
          ))}

          {typing && (
            <div className="flex justify-start">
              <div className="whatsapp-bubble-incoming px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-[#8696a0] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-[#8696a0] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-[#8696a0] animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="bg-[#1f2c34] px-3 py-3 flex items-center gap-2 shrink-0">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Mensagem"
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#2a3942] text-sm text-[#e9edef] placeholder-[#8696a0] border-none focus:outline-none"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim()}
            className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#06cf9c] flex items-center justify-center cursor-pointer disabled:opacity-40 transition-colors shrink-0"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───
export default function BotsPage() {
  const { bots, fetchBots, deleteBot, updateBot, loading } = useBotStore();
  const [showForm, setShowForm] = useState(false);
  const [editBot, setEditBot] = useState<Bot | null>(null);
  const [kwBot, setKwBot] = useState<Bot | null>(null);
  const [menuBot, setMenuBot] = useState<Bot | null>(null);
  const [waBot, setWaBot] = useState<Bot | null>(null);
  const [emulatorBot, setEmulatorBot] = useState<Bot | null>(null);

  useEffect(() => { fetchBots(); }, [fetchBots]);

  const toggleActive = async (bot: Bot) => {
    await updateBot(bot.id, { isActive: !bot.isActive });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>Bots</h1>
          <p className="text-base text-[var(--color-text-secondary)] mt-2">Gerencie seus chatbots</p>
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
          <BotIcon className="w-14 h-14 text-[var(--color-text-muted)] mb-4" />
          <p className="text-[var(--color-text-secondary)] text-base">Nenhum bot criado</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-2">Crie seu primeiro chatbot clicando no botão acima</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {bots.map((bot) => (
            <div key={bot.id} className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-6 hover:border-[var(--color-border-light)] transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${bot.isActive ? 'bg-green-400 shadow-sm shadow-green-400/50' : 'bg-[var(--color-text-muted)]'}`} />
                  <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{bot.name}</h3>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-accent-glow)] text-[var(--color-accent)] font-medium">
                    {bot.responseMode}
                  </span>
                  {bot.aiConfig && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 flex items-center gap-1.5">
                      <Cpu className="w-3 h-3" /> {bot.aiConfig.provider} - {bot.aiConfig.model}
                    </span>
                  )}
                  {bot.whatsappChannel && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 flex items-center gap-1.5">
                      <Zap className="w-3 h-3" /> {bot.whatsappChannel.phoneNumber}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button onClick={() => setEmulatorBot(bot)} className="p-2.5 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-all cursor-pointer" title="Testar Bot">
                    <Play className="w-4 h-4" />
                  </button>
                  <button onClick={() => toggleActive(bot)} className="p-2.5 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-all cursor-pointer" title={bot.isActive ? 'Desativar' : 'Ativar'}>
                    {bot.isActive ? <Power className="w-4 h-4 text-green-400" /> : <PowerOff className="w-4 h-4" />}
                  </button>
                  <button onClick={() => setKwBot(bot)} className="p-2.5 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-all cursor-pointer" title="Keywords">
                    <Key className="w-4 h-4" />
                  </button>
                  <button onClick={() => setMenuBot(bot)} className="p-2.5 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-all cursor-pointer" title="Menus Interativos">
                    <List className="w-4 h-4" />
                  </button>
                  <button onClick={() => setWaBot(bot)} className="p-2.5 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-all cursor-pointer" title="WhatsApp">
                    <Phone className="w-4 h-4" />
                  </button>
                  <button onClick={() => { setEditBot(bot); setShowForm(true); }} className="p-2.5 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-all cursor-pointer" title="Editar">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteBot(bot.id)} className="p-2.5 rounded-lg hover:bg-red-500/10 text-[var(--color-text-muted)] hover:text-red-400 transition-all cursor-pointer" title="Excluir">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-5 mt-4 text-xs text-[var(--color-text-muted)]">
                <span className="flex items-center gap-1.5"><Key className="w-3.5 h-3.5" /> {bot._count?.keywords || 0} keywords</span>
                <span className="flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> {bot._count?.conversations || 0} conversas</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <BotFormModal open={showForm} onClose={() => setShowForm(false)} bot={editBot} />
      {kwBot && <KeywordsModal open={!!kwBot} onClose={() => setKwBot(null)} bot={kwBot} />}
      {menuBot && <MenusModal open={!!menuBot} onClose={() => setMenuBot(null)} bot={menuBot} />}
      {waBot && <WhatsAppModal open={!!waBot} onClose={() => setWaBot(null)} bot={waBot} />}
      {emulatorBot && <WhatsAppEmulator open={!!emulatorBot} onClose={() => setEmulatorBot(null)} bot={emulatorBot} />}
    </div>
  );
}
