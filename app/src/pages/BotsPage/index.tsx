import { useEffect, useState, useRef, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useBotStore, type Bot } from '@/stores/bot.store';
import { api, extractApiError, type InteractiveMenu, type MenuOption, type FlowConfig, type GotoTarget, type Keyword } from '@/services/api';
import { toast } from 'sonner';
import {
  Plus, Trash2, Pencil, Zap, Key, X, Power, PowerOff,
  MessageSquare, Bot as BotIcon, Phone, Loader2, Send,
  Play, ArrowLeft, Check, CheckCheck, List, Cpu,
  GitBranch, ChevronRight, ArrowRight,
} from 'lucide-react';
import './BotsPage.css';

// ─── Modal wrapper ───
function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal${wide ? ' modal--wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">{title}</h2>
          <button className="modal__close" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}

// ─── Form field helper ───
function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="form-field">
      <label className="form-label">{label}</label>
      {children}
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}

// ─── Goto Selector ───
function GotoSelector({
  gotoType, gotoTarget, onTypeChange, onTargetChange, keywords, menus, label,
}: {
  gotoType: GotoTarget['type'] | '';
  gotoTarget: string;
  onTypeChange: (v: GotoTarget['type'] | '') => void;
  onTargetChange: (v: string) => void;
  keywords: Keyword[];
  menus: InteractiveMenu[];
  label?: string;
}) {
  const targets = gotoType === 'MENU'
    ? menus.filter(m => m.isActive !== false)
    : gotoType === 'KEYWORD'
      ? keywords.filter(k => k.isActive !== false)
      : [];

  return (
    <div className="goto-selector">
      {label && <label className="goto-selector__label">{label}</label>}
      <div className="goto-selector__row">
        <select
          value={gotoType}
          onChange={(e) => { onTypeChange(e.target.value as GotoTarget['type'] | ''); onTargetChange(''); }}
          className="form-input"
        >
          <option value="">Sem goto</option>
          <option value="MENU">Goto Menu</option>
          <option value="KEYWORD">Goto Keyword</option>
        </select>
        {gotoType ? (
          <select value={gotoTarget} onChange={(e) => onTargetChange(e.target.value)} className="form-input">
            <option value="">Selecione...</option>
            {gotoType === 'MENU'
              ? (targets as InteractiveMenu[]).map((t) => (
                  <option key={t.trigger} value={t.trigger}>{t.trigger} — {t.title}</option>
                ))
              : (targets as Keyword[]).map((t) => (
                  <option key={t.trigger} value={t.trigger}>{t.trigger} → {t.response.substring(0, 40)}{t.response.length > 40 ? '...' : ''}</option>
                ))
            }
          </select>
        ) : (
          <div className="goto-selector__placeholder">Sem navegação</div>
        )}
      </div>
    </div>
  );
}

// ─── Bot Form Modal ───
function BotFormModal({ open, onClose, bot }: { open: boolean; onClose: () => void; bot?: Bot | null }) {
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({
    defaultValues: { name: bot?.name || '', responseMode: bot?.responseMode || 'KEYWORDS', systemPrompt: bot?.systemPrompt || '', aiConfigId: bot?.aiConfigId || '' },
  });
  const { createBot, updateBot } = useBotStore();
  const [saving, setSaving] = useState(false);
  const [aiConfigs, setAiConfigs] = useState<any[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [menus, setMenus] = useState<InteractiveMenu[]>([]);
  const responseMode = watch('responseMode');

  const [initType, setInitType] = useState<GotoTarget['type'] | ''>(bot?.flowConfig?.initialInteraction?.type || '');
  const [initTarget, setInitTarget] = useState(bot?.flowConfig?.initialInteraction?.target || '');
  const [fallbackMsg, setFallbackMsg] = useState(bot?.flowConfig?.fallback?.message || '');
  const [fallbackGotoType, setFallbackGotoType] = useState<GotoTarget['type'] | ''>(bot?.flowConfig?.fallback?.goto?.type || '');
  const [fallbackGotoTarget, setFallbackGotoTarget] = useState(bot?.flowConfig?.fallback?.goto?.target || '');

  useEffect(() => {
    reset({ name: bot?.name || '', responseMode: bot?.responseMode || 'KEYWORDS', systemPrompt: bot?.systemPrompt || '', aiConfigId: bot?.aiConfigId || '' });
    setInitType(bot?.flowConfig?.initialInteraction?.type || '');
    setInitTarget(bot?.flowConfig?.initialInteraction?.target || '');
    setFallbackMsg(bot?.flowConfig?.fallback?.message || '');
    setFallbackGotoType(bot?.flowConfig?.fallback?.goto?.type || '');
    setFallbackGotoTarget(bot?.flowConfig?.fallback?.goto?.target || '');
  }, [bot, reset]);

  useEffect(() => {
    if (open) {
      api.getAiConfigs().then(setAiConfigs).catch(() => setAiConfigs([]));
      if (bot) {
        api.getKeywords(bot.id).then(setKeywords).catch(() => setKeywords([]));
        api.getMenus(bot.id).then(setMenus).catch(() => setMenus([]));
      }
    }
  }, [open, bot]);

  const onSubmit = async (data: any) => {
    setSaving(true);
    try {
      const flowConfig: FlowConfig = {};
      if (initType && initTarget) flowConfig.initialInteraction = { type: initType, target: initTarget };
      if (fallbackMsg.trim()) {
        flowConfig.fallback = {
          message: fallbackMsg.trim(),
          goto: fallbackGotoType && fallbackGotoTarget ? { type: fallbackGotoType, target: fallbackGotoTarget } : undefined,
        };
      }
      const payload = { name: data.name, responseMode: data.responseMode, systemPrompt: data.systemPrompt || undefined, initialMessage: undefined, aiConfigId: data.aiConfigId || null, flowConfig: Object.keys(flowConfig).length > 0 ? flowConfig : undefined };
      if (bot) {
        await updateBot(bot.id, payload);
        toast.success('Bot atualizado com sucesso!');
      } else {
        await createBot(payload);
        toast.success('Bot criado com sucesso!');
      }
      onClose();
    } catch (err) {
      toast.error(`Erro ao salvar bot: ${extractApiError(err)}`);
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={bot ? 'Editar Bot' : 'Novo Bot'} wide>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="form-row">
          <FormField label="Nome do Bot" error={errors.name?.message}>
            <input {...register('name', { required: 'Nome obrigatório' })} placeholder="Ex: Atendimento" className="form-input" />
          </FormField>
          <FormField label="Modo de resposta">
            <select {...register('responseMode')} className="form-input">
              <option value="KEYWORDS">Keywords</option>
              <option value="AI">I.A.</option>
              <option value="HYBRID">Hibrido</option>
            </select>
          </FormField>
        </div>

        {(responseMode === 'AI' || responseMode === 'HYBRID') && (
          <FormField label="Configuração de I.A.">
            <select {...register('aiConfigId')} className="form-input">
              <option value="">Padrão do sistema</option>
              {aiConfigs.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name} ({c.provider} - {c.model})</option>
              ))}
            </select>
          </FormField>
        )}

        <div className="bot-form__section">
          <label className="bot-form__section-label">
            <ArrowRight size={15} color="var(--color-accent)" /> Primeira interação do bot
          </label>
          <p className="bot-form__section-hint">
            Escolha qual keyword ou menu será enviado quando o usuário iniciar a conversa.
          </p>
          {bot ? (
            <GotoSelector gotoType={initType} gotoTarget={initTarget} onTypeChange={setInitType} onTargetChange={setInitTarget} keywords={keywords} menus={menus} />
          ) : (
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              Salve o bot primeiro e depois configure a primeira interação.
            </p>
          )}
        </div>

        <FormField label="System Prompt (IA)">
          <textarea {...register('systemPrompt')} placeholder="Instruções para a IA..." rows={3} className="form-input form-textarea" />
        </FormField>

        <div className="bot-form__section">
          <label className="bot-form__section-label" style={{ color: 'var(--color-text-secondary)' }}>Fallback (quando algo falha)</label>
          <FormField label="Mensagem de fallback">
            <input value={fallbackMsg} onChange={(e) => setFallbackMsg(e.target.value)} placeholder="Desculpe, ocorreu um erro..." className="form-input" />
          </FormField>
          {bot && (
            <GotoSelector gotoType={fallbackGotoType} gotoTarget={fallbackGotoTarget} onTypeChange={setFallbackGotoType} onTargetChange={setFallbackGotoTarget} keywords={keywords} menus={menus} label="Goto após fallback" />
          )}
        </div>

        <div className="modal__footer">
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancelar</button>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving && <Loader2 size={15} className="animate-spin" />}
            {bot ? 'Salvar' : 'Criar Bot'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Keywords Modal ───
function KeywordsModal({ open, onClose, bot }: { open: boolean; onClose: () => void; bot: Bot }) {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [menus, setMenus] = useState<InteractiveMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const { register, handleSubmit, reset } = useForm({ defaultValues: { trigger: '', response: '', priority: 0 } });
  const [gotoType, setGotoType] = useState<GotoTarget['type'] | ''>('');
  const [gotoTarget, setGotoTarget] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [kws, mns] = await Promise.all([api.getKeywords(bot.id), api.getMenus(bot.id)]);
      setKeywords(kws);
      setMenus(mns);
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { if (open) load(); }, [open]);

  const onAdd = async (data: any) => {
    const goto = gotoType && gotoTarget ? { type: gotoType, target: gotoTarget } : undefined;
    try {
      await api.createKeyword(bot.id, { ...data, priority: Number(data.priority) || 0, goto });
      toast.success('Keyword adicionada!');
      reset();
      setGotoType('');
      setGotoTarget('');
      load();
    } catch (err) {
      toast.error(`Erro ao adicionar keyword: ${extractApiError(err)}`);
    }
  };

  const onDelete = async (kwId: string) => {
    try {
      await api.deleteKeyword(bot.id, kwId);
      toast.success('Keyword removida!');
      load();
    } catch (err) {
      toast.error(`Erro ao remover keyword: ${extractApiError(err)}`);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Keywords — ${bot.name}`} wide>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 18 }}>
        Matching case-insensitive. Use goto para direcionar o bot a outro fluxo após a resposta.
      </p>
      <form onSubmit={handleSubmit(onAdd)} className="keyword-form">
        <div className="keyword-form__inputs">
          <input {...register('trigger', { required: true })} placeholder="Palavra-chave" className="form-input" style={{ flex: 1 }} />
          <input {...register('response', { required: true })} placeholder="Resposta do bot" className="form-input" style={{ flex: 1 }} />
        </div>
        <GotoSelector gotoType={gotoType} gotoTarget={gotoTarget} onTypeChange={setGotoType} onTargetChange={setGotoTarget} keywords={keywords} menus={menus} label="Goto (navegação após resposta)" />
        <div className="keyword-form__submit">
          <button type="submit" className="btn btn-primary">
            <Plus size={15} /> Adicionar
          </button>
        </div>
      </form>

      <div className="keywords-list">
        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Carregando...</p>
        ) : keywords.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', padding: '24px 0' }}>Nenhuma keyword cadastrada.</p>
        ) : keywords.map((kw) => (
          <div key={kw.id} className="keyword-row">
            <div className="keyword-row__content">
              <div className="keyword-row__trigger-line">
                <span className="keyword-row__trigger">{kw.trigger}</span>
                <span className="keyword-row__arrow">→</span>
                <span className="keyword-row__response">{kw.response}</span>
              </div>
              {kw.goto && (
                <div className="keyword-row__goto">
                  <ArrowRight size={11} /> goto {kw.goto.type.toLowerCase()}: {kw.goto.target}
                </div>
              )}
            </div>
            <button className="keyword-row__delete" onClick={() => onDelete(kw.id)}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ─── Menus Modal ───
function MenusModal({ open, onClose, bot }: { open: boolean; onClose: () => void; bot: Bot }) {
  const [menus, setMenus] = useState<InteractiveMenu[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const { register, handleSubmit, reset } = useForm({ defaultValues: { trigger: '', title: '', body: '', footer: '' } });
  const [options, setOptions] = useState<MenuOption[]>([]);
  const [optTitle, setOptTitle] = useState('');
  const [optDesc, setOptDesc] = useState('');
  const [optGotoType, setOptGotoType] = useState<GotoTarget['type'] | ''>('');
  const [optGotoTarget, setOptGotoTarget] = useState('');

  const resetFormState = () => {
    reset({ trigger: '', title: '', body: '', footer: '' });
    setOptions([]);
    setOptTitle('');
    setOptDesc('');
    setOptGotoType('');
    setOptGotoTarget('');
    setEditingMenuId(null);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [menusData, keywordsData] = await Promise.all([api.getMenus(bot.id), api.getKeywords(bot.id)]);
      setMenus(menusData);
      setKeywords(keywordsData);
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { if (open) load(); }, [open]);

  const addOption = () => {
    if (!optTitle.trim()) return;
    const goto = optGotoType && optGotoTarget.trim() ? { type: optGotoType, target: optGotoTarget.trim() } : undefined;
    setOptions([...options, { id: `opt_${Date.now()}`, title: optTitle.trim(), description: optDesc.trim() || undefined, goto }]);
    setOptTitle('');
    setOptDesc('');
    setOptGotoType('');
    setOptGotoTarget('');
  };

  const removeOption = (id: string) => setOptions(options.filter((o) => o.id !== id));

  const onSubmitMenu = async (data: any) => {
    if (options.length === 0) return;
    const payload = { trigger: data.trigger, title: data.title, body: data.body || undefined, footer: data.footer || undefined, options };
    try {
      if (editingMenuId) {
        await api.updateMenu(bot.id, editingMenuId, payload);
        toast.success('Menu atualizado com sucesso!');
      } else {
        await api.createMenu(bot.id, payload);
        toast.success('Menu criado com sucesso!');
      }
      resetFormState();
      setShowAdd(false);
      load();
    } catch (err) {
      toast.error(`Erro ao salvar menu: ${extractApiError(err)}`);
    }
  };

  const onStartEditMenu = (menu: InteractiveMenu) => {
    setShowAdd(true);
    setEditingMenuId(menu.id);
    reset({ trigger: menu.trigger, title: menu.title, body: menu.body || '', footer: menu.footer || '' });
    setOptions(menu.options || []);
  };

  const onDeleteMenu = async (menuId: string) => {
    try {
      await api.deleteMenu(bot.id, menuId);
      toast.success('Menu removido!');
      load();
    } catch (err) {
      toast.error(`Erro ao remover menu: ${extractApiError(err)}`);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Menus Interativos — ${bot.name}`} wide>
      {showAdd ? (
        <form onSubmit={handleSubmit(onSubmitMenu)}>
          <div className="form-row">
            <FormField label="Trigger (palavra-chave)">
              <input {...register('trigger', { required: true })} placeholder="Ex: menu, opções" className="form-input" />
            </FormField>
            <FormField label="Título do menu">
              <input {...register('title', { required: true })} placeholder="Ex: Menu Principal" className="form-input" />
            </FormField>
          </div>
          <div className="form-row">
            <FormField label="Corpo (descrição)">
              <input {...register('body')} placeholder="Escolha uma opção abaixo" className="form-input" />
            </FormField>
            <FormField label="Rodapé (opcional)">
              <input {...register('footer')} placeholder="Responda com o número" className="form-input" />
            </FormField>
          </div>

          <div className="form-field">
            <label className="form-label">Opções do menu</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, marginBottom: 10 }}>
              <input value={optTitle} onChange={(e) => setOptTitle(e.target.value)} placeholder="Título da opção" className="form-input" />
              <input value={optDesc} onChange={(e) => setOptDesc(e.target.value)} placeholder="Descrição (opcional)" className="form-input" />
              <button type="button" onClick={addOption} className="btn btn-primary" style={{ flexShrink: 0 }}>
                <Plus size={15} />
              </button>
            </div>
            <GotoSelector gotoType={optGotoType} gotoTarget={optGotoTarget} onTypeChange={setOptGotoType} onTargetChange={setOptGotoTarget} keywords={keywords} menus={menus} label="Goto da opção (navegação após seleção)" />
            <div className="option-builder__list">
              {options.map((opt, i) => (
                <div key={opt.id} className="option-builder__item">
                  <span className="option-builder__item-text">
                    <span className="option-builder__item-number">{i + 1}.</span>{' '}
                    {opt.title}
                    {opt.description && <span className="option-builder__item-muted"> - {opt.description}</span>}
                    {opt.goto && <span className="option-builder__item-goto"> → {opt.goto.type}:{opt.goto.target}</span>}
                  </span>
                  <button type="button" className="option-builder__item-remove" onClick={() => removeOption(opt.id)}>
                    <X size={13} />
                  </button>
                </div>
              ))}
              {options.length === 0 && (
                <p className="option-builder__empty">Adicione pelo menos uma opção ao menu</p>
              )}
            </div>
          </div>

          <div className="modal__footer">
            <button type="button" onClick={() => { setShowAdd(false); resetFormState(); }} className="btn btn-secondary">Cancelar</button>
            <button type="submit" disabled={options.length === 0} className="btn btn-primary">
              {editingMenuId ? 'Salvar alterações' : 'Criar Menu'}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}>
            <button className="btn btn-primary" onClick={() => { resetFormState(); setShowAdd(true); }}>
              <Plus size={15} /> Novo Menu
            </button>
          </div>
          <div className="menus-list">
            {loading ? (
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Carregando...</p>
            ) : menus.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', padding: '24px 0' }}>Nenhum menu interativo criado.</p>
            ) : menus.map((menu) => (
              <div key={menu.id} className="menu-item">
                <div className="menu-item__header">
                  <div className="menu-item__header-left">
                    <span className="badge badge-accent">{menu.trigger}</span>
                    <span className="menu-item__title">{menu.title}</span>
                  </div>
                  <div className="menu-item__actions">
                    <button className="btn btn-icon" onClick={() => onStartEditMenu(menu)}><Pencil size={14} /></button>
                    <button className="btn btn-icon" onClick={() => onDeleteMenu(menu.id)} style={{ color: 'var(--color-text-muted)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171'; (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = ''; (e.currentTarget as HTMLElement).style.background = ''; }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="menu-item__options">
                  {(menu.options || []).map((opt, i) => (
                    <div key={opt.id} className="menu-item__option">
                      <span style={{ color: 'var(--color-accent)' }}>{i + 1}.</span> {opt.title}
                      {opt.description && <span style={{ color: 'var(--color-text-muted)' }}> - {opt.description}</span>}
                      {opt.goto && <span className="menu-item__option-goto"> → {opt.goto.type}:{opt.goto.target}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

// ─── WhatsApp Modal ───
function WhatsAppModal({ open, onClose, bot }: { open: boolean; onClose: () => void; bot: Bot }) {
  const { register, handleSubmit, formState: { errors }, watch } = useForm({
    defaultValues: {
      phoneNumber: '',
      provider: 'EVOLUTION' as 'DIALOG360' | 'EVOLUTION',
      dialog360ApiKey: '',
      evolutionApiUrl: '',
      evolutionApiKey: '',
      evolutionInstance: '',
    },
  });
  const [saving, setSaving] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<string | null>(null);
  const { fetchBots } = useBotStore();
  const hasChannel = !!bot.whatsappChannel;
  const provider = watch('provider');

  const onSubmit = async (data: any) => {
    setSaving(true);
    try {
      const payload: any = {
        phoneNumber: data.phoneNumber,
        provider: data.provider,
      };
      if (data.provider === 'DIALOG360') {
        payload.dialog360ApiKey = data.dialog360ApiKey;
      } else {
        payload.evolutionApiUrl = data.evolutionApiUrl;
        payload.evolutionApiKey = data.evolutionApiKey;
        payload.evolutionInstance = data.evolutionInstance;
      }
      await api.createWhatsappChannel(bot.id, payload);
      await fetchBots();
      toast.success('WhatsApp conectado com sucesso!');

      // Se Evolution, buscar QR Code
      if (data.provider === 'EVOLUTION') {
        try {
          const qr = await api.getEvolutionQrCode(bot.id);
          if (qr?.base64 || qr?.code) {
            setQrCode(qr.base64 || qr.code);
          }
        } catch {
          toast.success('Canal criado! Use o QR Code na Evolution API para conectar.');
        }
      } else {
        onClose();
      }
    } catch (err) {
      toast.error(`Erro ao conectar WhatsApp: ${extractApiError(err)}`);
    } finally { setSaving(false); }
  };

  const onDisconnect = async () => {
    try {
      await api.deleteWhatsappChannel(bot.id);
      await fetchBots();
      toast.success('WhatsApp desconectado!');
      setQrCode(null);
      setConnectionState(null);
      onClose();
    } catch (err) {
      toast.error(`Erro ao desconectar WhatsApp: ${extractApiError(err)}`);
    }
  };

  const checkEvolutionStatus = async () => {
    try {
      const state = await api.getEvolutionConnectionState(bot.id);
      setConnectionState(state?.instance?.state || state?.state || 'unknown');
      if (state?.instance?.state === 'open' || state?.state === 'open') {
        toast.success('WhatsApp conectado via Evolution!');
        await fetchBots();
      }
    } catch {
      setConnectionState('erro');
    }
  };

  const fetchQrCode = async () => {
    try {
      const qr = await api.getEvolutionQrCode(bot.id);
      if (qr?.base64) {
        setQrCode(qr.base64);
      } else if (qr?.code) {
        setQrCode(qr.code);
      }
    } catch {
      toast.error('Erro ao buscar QR Code');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`WhatsApp — ${bot.name}`}>
      {hasChannel ? (
        <div className="wa-connected">
          <div className="wa-connected__status">
            <div className="wa-connected__status-header">
              <Zap size={15} /> Conectado
              <span className="badge badge-accent" style={{ marginLeft: 8, fontSize: 10 }}>
                {bot.whatsappChannel?.provider || 'DIALOG360'}
              </span>
            </div>
            <p className="wa-connected__phone">{bot.whatsappChannel?.phoneNumber}</p>
            {bot.whatsappChannel?.evolutionInstance && (
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                Instância: {bot.whatsappChannel.evolutionInstance}
              </p>
            )}
          </div>

          {bot.whatsappChannel?.provider === 'EVOLUTION' && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button onClick={fetchQrCode} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
                QR Code
              </button>
              <button onClick={checkEvolutionStatus} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
                Verificar Status
              </button>
            </div>
          )}

          {qrCode && (
            <div style={{ textAlign: 'center', margin: '12px 0', padding: 16, background: '#fff', borderRadius: 8 }}>
              {qrCode.startsWith('data:') || qrCode.startsWith('http') ? (
                <img src={qrCode} alt="QR Code" style={{ maxWidth: 256, width: '100%' }} />
              ) : (
                <div style={{ wordBreak: 'break-all', fontSize: 10, color: '#333', maxHeight: 200, overflow: 'auto' }}>
                  <p style={{ fontWeight: 600, marginBottom: 8, color: '#000' }}>Escaneie este QR Code no WhatsApp:</p>
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrCode)}`} alt="QR Code" style={{ maxWidth: 256, width: '100%' }} />
                </div>
              )}
            </div>
          )}

          {connectionState && (
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <span className={`badge ${connectionState === 'open' ? 'badge-green' : 'badge-accent'}`}>
                Status: {connectionState === 'open' ? 'Conectado' : connectionState}
              </span>
            </div>
          )}

          <button onClick={onDisconnect} className="btn btn-danger" style={{ width: '100%', justifyContent: 'center' }}>
            <Trash2 size={15} /> Desconectar WhatsApp
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)}>
          <FormField label="Provedor">
            <select {...register('provider')} className="form-input">
              <option value="EVOLUTION">Evolution API (QR Code)</option>
              <option value="DIALOG360">Dialog360 (API Key)</option>
            </select>
          </FormField>

          <FormField label="Número WhatsApp" error={errors.phoneNumber?.message}>
            <div className="input-wrapper">
              <span className="input-icon"><Phone size={16} /></span>
              <input {...register('phoneNumber', { required: 'Obrigatório' })} placeholder="+5511999999999" className="form-input with-icon" />
            </div>
          </FormField>

          {provider === 'DIALOG360' ? (
            <FormField label="Dialog360 API Key" error={errors.dialog360ApiKey?.message}>
              <div className="input-wrapper">
                <span className="input-icon"><Key size={16} /></span>
                <input {...register('dialog360ApiKey', { required: provider === 'DIALOG360' ? 'Obrigatório' : false })} placeholder="Sua API Key" className="form-input with-icon" />
              </div>
            </FormField>
          ) : (
            <>
              <FormField label="URL da Evolution API" error={errors.evolutionApiUrl?.message}>
                <div className="input-wrapper">
                  <span className="input-icon"><Zap size={16} /></span>
                  <input {...register('evolutionApiUrl', { required: provider === 'EVOLUTION' ? 'Obrigatório' : false })} placeholder="https://sua-evolution-api.com" className="form-input with-icon" />
                </div>
              </FormField>
              <FormField label="Global API Key" error={errors.evolutionApiKey?.message}>
                <div className="input-wrapper">
                  <span className="input-icon"><Key size={16} /></span>
                  <input {...register('evolutionApiKey', { required: provider === 'EVOLUTION' ? 'Obrigatório' : false })} placeholder="Sua API Key da Evolution" className="form-input with-icon" />
                </div>
              </FormField>
              <FormField label="Nome da Instância" error={errors.evolutionInstance?.message}>
                <div className="input-wrapper">
                  <span className="input-icon"><MessageSquare size={16} /></span>
                  <input {...register('evolutionInstance', { required: provider === 'EVOLUTION' ? 'Obrigatório' : false })} placeholder="minha-instancia" className="form-input with-icon" />
                </div>
              </FormField>
            </>
          )}

          <button type="submit" disabled={saving} className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}>
            {saving && <Loader2 size={15} className="animate-spin" />}
            Conectar WhatsApp
          </button>
        </form>
      )}
    </Modal>
  );
}

// ─── Flow Tree ───
interface TreeNode {
  id: string;
  label: string;
  type: 'initial' | 'keyword' | 'menu' | 'option' | 'fallback';
  children: TreeNode[];
  gotoLabel?: string;
}

function buildFlowTree(bot: Bot, keywords: Keyword[], menus: InteractiveMenu[]): TreeNode {
  const resolveGoto = (goto: GotoTarget, depth: number, pathVisited: Set<string>): TreeNode | null => {
    if (depth > 10) return null;
    const key = `${goto.type}:${goto.target.toLowerCase()}`;
    if (pathVisited.has(key)) {
      return { id: `loop_${key}_d${depth}`, label: `↩ ${goto.target} (referência circular)`, type: goto.type === 'MENU' ? 'menu' : 'keyword', children: [] };
    }
    const nextPath = new Set(pathVisited);
    nextPath.add(key);

    if (goto.type === 'MENU') {
      const menu = menus.find(m => m.trigger.toLowerCase() === goto.target.toLowerCase());
      if (!menu) return { id: `menu_missing_${goto.target}_d${depth}`, label: `Menu: ${goto.target} (não encontrado)`, type: 'menu', children: [] };
      return {
        id: `menu_${menu.id}_d${depth}`, label: `Menu: ${menu.title}`, type: 'menu',
        children: (menu.options || []).map((opt, i) => {
          const optNode: TreeNode = { id: `opt_${opt.id}_d${depth}_i${i}`, label: opt.title, type: 'option', children: [], gotoLabel: opt.goto ? `→ ${opt.goto.type.toLowerCase()}: ${opt.goto.target}` : undefined };
          if (opt.goto) { const child = resolveGoto(opt.goto, depth + 1, nextPath); if (child) optNode.children.push(child); }
          return optNode;
        }),
      };
    }
    if (goto.type === 'KEYWORD') {
      const kw = keywords.find(k => k.trigger.toLowerCase() === goto.target.toLowerCase());
      if (!kw) return { id: `kw_missing_${goto.target}_d${depth}`, label: `Keyword: ${goto.target} (não encontrada)`, type: 'keyword', children: [] };
      const kwNode: TreeNode = { id: `kw_${kw.id}_d${depth}`, label: `Keyword: ${kw.trigger}`, type: 'keyword', children: [], gotoLabel: kw.goto ? `→ ${kw.goto.type.toLowerCase()}: ${kw.goto.target}` : undefined };
      if (kw.goto) { const child = resolveGoto(kw.goto, depth + 1, nextPath); if (child) kwNode.children.push(child); }
      return kwNode;
    }
    return null;
  };

  const root: TreeNode = { id: 'root', label: bot.name, type: 'initial', children: [] };
  const flow = bot.flowConfig;

  if (flow?.initialInteraction) {
    const initNode = resolveGoto(flow.initialInteraction, 0, new Set());
    if (initNode) root.children.push(initNode);
  }

  const referencedKeywords = new Set<string>();
  const referencedMenus = new Set<string>();
  const collectRefs = (goto: GotoTarget | undefined) => {
    if (!goto) return;
    if (goto.type === 'KEYWORD') referencedKeywords.add(goto.target.toLowerCase());
    if (goto.type === 'MENU') referencedMenus.add(goto.target.toLowerCase());
  };
  collectRefs(flow?.initialInteraction);
  collectRefs(flow?.fallback?.goto);
  for (const kw of keywords) collectRefs(kw.goto);
  for (const menu of menus) for (const opt of (menu.options || [])) collectRefs(opt.goto);

  for (const kw of keywords) {
    if (!referencedKeywords.has(kw.trigger.toLowerCase()) && kw.isActive) {
      const kwNode: TreeNode = { id: `standalone_kw_${kw.id}`, label: `Keyword: ${kw.trigger}`, type: 'keyword', children: [], gotoLabel: kw.goto ? `→ ${kw.goto.type.toLowerCase()}: ${kw.goto.target}` : undefined };
      if (kw.goto) { const child = resolveGoto(kw.goto, 0, new Set([`KEYWORD:${kw.trigger.toLowerCase()}`])); if (child) kwNode.children.push(child); }
      root.children.push(kwNode);
    }
  }

  for (const menu of menus) {
    if (!referencedMenus.has(menu.trigger.toLowerCase()) && menu.isActive) {
      const menuNode = resolveGoto({ type: 'MENU', target: menu.trigger }, 0, new Set());
      if (menuNode) root.children.push(menuNode);
    }
  }

  if (flow?.fallback) {
    const fbNode: TreeNode = { id: 'fallback', label: `Fallback: ${flow.fallback.message.substring(0, 40)}${flow.fallback.message.length > 40 ? '...' : ''}`, type: 'fallback', children: [] };
    if (flow.fallback.goto) { const child = resolveGoto(flow.fallback.goto, 0, new Set()); if (child) fbNode.children.push(child); }
    root.children.push(fbNode);
  }

  return root;
}

function TreeNodeView({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const icons: Record<TreeNode['type'], React.ReactNode> = {
    initial: <BotIcon size={12} />,
    keyword: <Key size={12} />,
    menu: <List size={12} />,
    option: <ChevronRight size={12} />,
    fallback: <ArrowRight size={12} />,
  };

  return (
    <div style={{ position: 'relative', marginLeft: depth > 0 ? 24 : 0 }}>
      {depth > 0 && <div className="flow-tree__connector-v" />}
      {depth > 0 && <div className="flow-tree__connector-h" />}

      <div className="flow-tree__node">
        <span className={`flow-tree__label flow-tree__label--${node.type}`}>
          {icons[node.type]} {node.label}
        </span>
        {node.gotoLabel && (
          <span className="flow-tree__goto-badge">{node.gotoLabel}</span>
        )}
      </div>

      {node.children.length > 0 && (
        <div style={{ marginLeft: 16, position: 'relative' }}>
          <div style={{ position: 'absolute', left: -8, top: 0, bottom: 0, width: 1, background: 'var(--color-border)' }} />
          {node.children.map((child) => (
            <TreeNodeView key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function FlowTreeModal({ open, onClose, bot }: { open: boolean; onClose: () => void; bot: Bot }) {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [menus, setMenus] = useState<InteractiveMenu[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      setLoading(true);
      Promise.all([api.getKeywords(bot.id), api.getMenus(bot.id)])
        .then(([kws, mns]) => { setKeywords(kws); setMenus(mns); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [open, bot.id]);

  const tree = useMemo(() => {
    if (loading) return null;
    return buildFlowTree(bot, keywords, menus);
  }, [bot, keywords, menus, loading]);

  return (
    <Modal open={open} onClose={onClose} title={`Árvore do Fluxo — ${bot.name}`} wide>
      {loading ? (
        <div className="loader" style={{ padding: '40px 0' }}>
          <Loader2 size={18} className="animate-spin" /> Carregando...
        </div>
      ) : tree && tree.children.length > 0 ? (
        <div>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 16 }}>
            Nós com <span style={{ color: '#60a5fa' }}>→ goto</span> são referências many-to-many — o mesmo menu/keyword pode ser referenciado em múltiplos lugares.
          </p>
          <div style={{ maxHeight: 520, overflowY: 'auto', overflowX: 'auto', paddingRight: 8 }}>
            <TreeNodeView node={tree} />
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <GitBranch size={40} className="empty-state__icon" />
          <p className="empty-state__text">
            Nenhum fluxo configurado. Adicione keywords, menus e configure a primeira interação.
          </p>
        </div>
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
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [menus, setMenus] = useState<InteractiveMenu[]>([]);
  const [initialized, setInitialized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setMessages([]);
      setInput('');
      setInitialized(false);
      Promise.all([api.getKeywords(bot.id), api.getMenus(bot.id)])
        .then(([kws, mns]) => { setKeywords(kws); setMenus(mns); })
        .catch(() => { setKeywords([]); setMenus([]); });
    }
  }, [open, bot.id]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const now = () => { const d = new Date(); return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`; };

  const findMenuByTrigger = (trigger: string): InteractiveMenu | null =>
    menus.find(m => m.isActive !== false && m.trigger.toLowerCase() === trigger.toLowerCase().trim()) || null;

  const findMenuMatch = (text: string): InteractiveMenu | null => {
    const normalized = text.toLowerCase().trim();
    for (const menu of menus) {
      if (menu.isActive !== false && normalized.includes(menu.trigger.toLowerCase())) return menu;
    }
    return null;
  };

  const findKeywordByTrigger = (trigger: string): Keyword | null =>
    keywords.find(k => k.isActive !== false && k.trigger.toLowerCase() === trigger.toLowerCase().trim()) || null;

  const findKeywordMatch = (text: string): Keyword | null => {
    const normalized = text.toLowerCase().trim();
    const sorted = [...keywords].sort((a, b) => (b.priority || 0) - (a.priority || 0));
    for (const kw of sorted) {
      if (kw.isActive !== false && normalized.includes(kw.trigger.toLowerCase())) return kw;
    }
    return null;
  };

  const generateAIResponse = (text: string): string => {
    const lower = text.toLowerCase();
    if (lower.includes('olá') || lower.includes('oi') || lower.includes('bom dia') || lower.includes('boa tarde')) return `Olá! Sou o assistente ${bot.name}. Como posso ajudar você hoje?`;
    if (lower.includes('preço') || lower.includes('valor') || lower.includes('quanto')) return 'Para informações sobre preços, por favor entre em contato com nossa equipe comercial.';
    if (lower.includes('obrigado') || lower.includes('valeu')) return 'Por nada! Se precisar de mais alguma coisa, é só falar!';
    return `Entendi sua mensagem. Sou o assistente ${bot.name} e estou aqui para ajudar. Pode me contar mais detalhes?`;
  };

  const addBotMessage = (text: string, isMenu?: boolean, menuOptions?: MenuOption[]) => {
    const botMsg: EmulatorMessage = { id: (Date.now() + Math.random()).toString(), text, direction: 'incoming', time: now(), isMenu, menuOptions };
    setMessages((prev) => [...prev, botMsg]);
    return botMsg;
  };

  const executeGoto = (goto: GotoTarget, depth = 0) => {
    if (depth > 5) return;
    setTimeout(() => {
      if (goto.type === 'MENU') {
        const menu = findMenuByTrigger(goto.target);
        if (menu) {
          const text = `📋 ${menu.title}\n${menu.body || ''}\n\n${(menu.options || []).map((o, i) => `${i + 1}. ${o.title}${o.description ? ' - ' + o.description : ''}`).join('\n')}${menu.footer ? '\n\n' + menu.footer : ''}`;
          addBotMessage(text, true, menu.options);
        } else { addBotMessage(`Menu "${goto.target}" não encontrado.`); }
      } else if (goto.type === 'KEYWORD') {
        const kw = findKeywordByTrigger(goto.target);
        if (kw) { addBotMessage(kw.response); if (kw.goto) executeGoto(kw.goto, depth + 1); }
        else { addBotMessage(`Keyword "${goto.target}" não encontrada.`); }
      }
    }, 400 + depth * 300);
  };

  const sendMessage = async (text?: string) => {
    const msgText = text || input.trim();
    if (!msgText) return;
    if (!text) setInput('');
    const isFirst = !initialized;
    setInitialized(true);

    const userMsg: EmulatorMessage = { id: Date.now().toString(), text: msgText, direction: 'outgoing', time: now(), status: 'sent' };
    setMessages((prev) => [...prev, userMsg]);
    setTimeout(() => setMessages((prev) => prev.map((m) => m.id === userMsg.id ? { ...m, status: 'delivered' as const } : m)), 500);
    setTimeout(() => setMessages((prev) => prev.map((m) => m.id === userMsg.id ? { ...m, status: 'read' as const } : m)), 1000);

    setTyping(true);
    const delay = 800 + Math.random() * 1200;
    setTimeout(() => {
      setTyping(false);
      if (isFirst && bot.flowConfig?.initialInteraction) { executeGoto(bot.flowConfig.initialInteraction); return; }
      const menuMatch = findMenuMatch(msgText);
      if (menuMatch) {
        const text = `📋 ${menuMatch.title}\n${menuMatch.body || ''}\n\n${(menuMatch.options || []).map((o, i) => `${i + 1}. ${o.title}${o.description ? ' - ' + o.description : ''}`).join('\n')}${menuMatch.footer ? '\n\n' + menuMatch.footer : ''}`;
        addBotMessage(text, true, menuMatch.options);
        return;
      }
      for (const menu of menus) {
        const opt = (menu.options || []).find(o => o.title.toLowerCase() === msgText.toLowerCase() || o.id.toLowerCase() === msgText.toLowerCase());
        if (opt) {
          if (opt.goto) { addBotMessage(`Você selecionou: ${opt.title}`); executeGoto(opt.goto); }
          else { addBotMessage(`Você selecionou: ${opt.title}${opt.description ? '\n' + opt.description : ''}`); }
          return;
        }
      }
      if (bot.responseMode === 'KEYWORDS' || bot.responseMode === 'HYBRID') {
        const kwMatch = findKeywordMatch(msgText);
        if (kwMatch) { addBotMessage(kwMatch.response); if (kwMatch.goto) executeGoto(kwMatch.goto); return; }
        if (bot.responseMode === 'HYBRID') { addBotMessage(generateAIResponse(msgText)); return; }
        addBotMessage('Desculpe, não entendi. Tente reformular sua pergunta.');
        return;
      }
      addBotMessage(generateAIResponse(msgText));
    }, delay);
  };

  if (!open) return null;

  return (
    <div className="wa-emulator" onClick={onClose}>
      <div className="wa-emulator__phone" onClick={(e) => e.stopPropagation()}>
        <div className="wa-emulator__header">
          <button className="wa-emulator__back" onClick={onClose}><ArrowLeft size={20} /></button>
          <div className="wa-emulator__avatar"><BotIcon size={20} color="#fff" /></div>
          <div className="wa-emulator__contact">
            <p className="wa-emulator__contact-name">{bot.name}</p>
            <p className="wa-emulator__contact-status">{typing ? 'digitando...' : 'online'}</p>
          </div>
          <span className="wa-emulator__mode-badge">{bot.responseMode}</span>
        </div>

        <div className="wa-emulator__chat whatsapp-chat-bg">
          {messages.length === 0 && (
            <div className="wa-emulator__empty">
              <div className="wa-emulator__empty-icon"><MessageSquare size={28} color="#8696a0" /></div>
              <p className="wa-emulator__empty-title">Emulador WhatsApp</p>
              <p className="wa-emulator__empty-text">
                Envie uma mensagem para simular uma conversa com o bot <strong style={{ color: '#8696a0' }}>{bot.name}</strong>
              </p>
              {bot.flowConfig?.initialInteraction && (
                <div className="wa-emulator__empty-tag" style={{ marginTop: 12, fontSize: 11 }}>
                  Primeira interação: {bot.flowConfig.initialInteraction.type.toLowerCase()} → {bot.flowConfig.initialInteraction.target}
                </div>
              )}
              <div className="wa-emulator__empty-tags">
                {bot.responseMode !== 'AI' && (
                  <span className="wa-emulator__empty-tag">{keywords.length} keyword{keywords.length !== 1 ? 's' : ''}</span>
                )}
                <span className="wa-emulator__empty-tag">{menus.length} menu{menus.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`wa-emulator__message-row wa-emulator__message-row--${msg.direction === 'outgoing' ? 'out' : 'in'}`}>
              <div className={`wa-emulator__bubble ${msg.direction === 'outgoing' ? 'whatsapp-bubble-outgoing' : 'whatsapp-bubble-incoming'}`} style={{ color: '#e9edef' }}>
                <span className="wa-emulator__bubble-text">{msg.text}</span>
                {msg.isMenu && msg.menuOptions && (
                  <div className="wa-emulator__menu-options">
                    {msg.menuOptions.map((opt) => (
                      <button key={opt.id} className="wa-emulator__menu-btn" onClick={() => sendMessage(opt.title)}>
                        {opt.title}
                        {opt.goto && <span className="wa-emulator__menu-btn-arrow">→</span>}
                      </button>
                    ))}
                  </div>
                )}
                <div className="wa-emulator__bubble-footer">
                  <span className="wa-emulator__bubble-time">{msg.time}</span>
                  {msg.direction === 'outgoing' && (
                    msg.status === 'read'
                      ? <CheckCheck size={13} color="#53bdeb" />
                      : msg.status === 'delivered'
                      ? <CheckCheck size={13} color="#8696a0" />
                      : <Check size={13} color="#8696a0" />
                  )}
                </div>
              </div>
            </div>
          ))}

          {typing && (
            <div className="wa-emulator__typing">
              <div className="whatsapp-bubble-incoming wa-emulator__typing-dots">
                <div className="wa-emulator__typing-dot animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="wa-emulator__typing-dot animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="wa-emulator__typing-dot animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="wa-emulator__input-row">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Mensagem"
            className="wa-emulator__input"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim()}
            className="wa-emulator__send"
          >
            <Send size={16} color="#fff" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Flow Preview (compact) ───
function buildFlowPreview(bot: Bot): string[] {
  const preview: string[] = [];
  const flow = bot.flowConfig;
  if (flow?.initialInteraction) preview.push(`inicio → ${flow.initialInteraction.type.toLowerCase()}: ${flow.initialInteraction.target}`);
  else if (bot.initialMessage?.trim()) preview.push(`inicio: ${bot.initialMessage.trim()}`);
  const steps = flow?.steps || [];
  for (const step of steps) {
    if (step.type === 'GOTO_MENU' && step.menuTrigger) preview.push(`goto menu: ${step.menuTrigger}`);
    if (step.type === 'GOTO_KEYWORD' && step.keywordTrigger) preview.push(`goto keyword: ${step.keywordTrigger}`);
  }
  if (flow?.fallback?.goto) preview.push(`fallback → ${flow.fallback.goto.type.toLowerCase()}: ${flow.fallback.goto.target}`);
  return preview;
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
  const [treeBot, setTreeBot] = useState<Bot | null>(null);

  useEffect(() => { fetchBots(); }, [fetchBots]);

  const toggleActive = async (bot: Bot) => {
    try {
      await updateBot(bot.id, { isActive: !bot.isActive });
      toast.success(bot.isActive ? `Bot "${bot.name}" desativado` : `Bot "${bot.name}" ativado`);
    } catch (err) {
      toast.error(`Erro ao alterar status do bot: ${extractApiError(err)}`);
    }
  };

  return (
    <div className="page-container bots-page">
      <div className="page-header">
        <div className="page-header__info">
          <h1 className="page-header__title">Bots</h1>
          <p className="page-header__subtitle">Gerencie seus chatbots</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditBot(null); setShowForm(true); }}>
          <Plus size={16} /> Novo Bot
        </button>
      </div>

      {loading ? (
        <div className="loader" style={{ height: 160 }}>
          <Loader2 size={18} className="animate-spin" /> Carregando...
        </div>
      ) : bots.length === 0 ? (
        <div className="empty-state">
          <BotIcon size={56} className="empty-state__icon" />
          <p className="empty-state__title">Nenhum bot criado</p>
          <p className="empty-state__text">Crie seu primeiro chatbot clicando no botão acima</p>
        </div>
      ) : (
        <div className="bots-list">
          {bots.map((bot) => (
            <div key={bot.id} className="bot-card">
              <div className="bot-card__top">
                <div className="bot-card__info">
                  <span className={`bot-card__status-dot ${bot.isActive ? 'bot-card__status-dot--active' : 'bot-card__status-dot--inactive'}`} />
                  <h3 className="bot-card__name">{bot.name}</h3>
                  <span className="badge badge-accent">{bot.responseMode}</span>
                  {bot.aiConfig && (
                    <span className="badge badge-purple" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Cpu size={10} /> {bot.aiConfig.provider} - {bot.aiConfig.model}
                    </span>
                  )}
                  {bot.whatsappChannel && (
                    <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Zap size={10} /> {bot.whatsappChannel.phoneNumber}
                      <span style={{ opacity: 0.7, fontSize: 9 }}>({bot.whatsappChannel.provider || 'DIALOG360'})</span>
                    </span>
                  )}
                </div>

                <div className="bot-card__actions">
                  <button className="btn btn-icon" style={{ color: 'var(--color-text-muted)' }} title="Testar Bot" onClick={() => setEmulatorBot(bot)}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-accent)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = ''; }}
                  ><Play size={15} /></button>
                  <button className="btn btn-icon" title="Árvore do Fluxo" onClick={() => setTreeBot(bot)}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#c084fc'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = ''; }}
                  ><GitBranch size={15} /></button>

                  <div className="btn-separator" />

                  <button className="btn btn-icon" title={bot.isActive ? 'Desativar' : 'Ativar'} onClick={() => toggleActive(bot)}>
                    {bot.isActive ? <Power size={15} color="#4ade80" /> : <PowerOff size={15} />}
                  </button>

                  <div className="btn-separator" />

                  <button className="btn btn-icon" title="Keywords" onClick={() => setKwBot(bot)}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#4ade80'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = ''; }}
                  ><Key size={15} /></button>
                  <button className="btn btn-icon" title="Menus Interativos" onClick={() => setMenuBot(bot)}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#60a5fa'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = ''; }}
                  ><List size={15} /></button>
                  <button className="btn btn-icon" title="WhatsApp" onClick={() => setWaBot(bot)}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#4ade80'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = ''; }}
                  ><Phone size={15} /></button>

                  <div className="btn-separator" />

                  <button className="btn btn-icon" title="Editar" onClick={() => { setEditBot(bot); setShowForm(true); }}>
                    <Pencil size={15} />
                  </button>
                  <button className="btn btn-icon" title="Excluir"
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171'; (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = ''; (e.currentTarget as HTMLElement).style.background = ''; }}
                    onClick={async () => {
                      try { await deleteBot(bot.id); toast.success(`Bot "${bot.name}" excluído!`); }
                      catch (err) { toast.error(`Erro ao excluir bot: ${extractApiError(err)}`); }
                    }}
                  ><Trash2 size={15} /></button>
                </div>
              </div>

              <div className="bot-card__meta">
                <span className="bot-card__meta-item"><Key size={13} /> {bot._count?.keywords || 0} keywords</span>
                <span className="bot-card__meta-item"><MessageSquare size={13} /> {bot._count?.conversations || 0} conversas</span>
              </div>

              {buildFlowPreview(bot).length > 0 && (
                <div className="bot-card__flow">
                  <p className="bot-card__flow-label">
                    <GitBranch size={12} /> Fluxo
                  </p>
                  <p className="bot-card__flow-text">
                    {buildFlowPreview(bot).join(' > ')}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <BotFormModal open={showForm} onClose={() => setShowForm(false)} bot={editBot} />
      {kwBot && <KeywordsModal open={!!kwBot} onClose={() => setKwBot(null)} bot={kwBot} />}
      {menuBot && <MenusModal open={!!menuBot} onClose={() => setMenuBot(null)} bot={menuBot} />}
      {waBot && <WhatsAppModal open={!!waBot} onClose={() => setWaBot(null)} bot={waBot} />}
      {emulatorBot && <WhatsAppEmulator open={!!emulatorBot} onClose={() => setEmulatorBot(null)} bot={emulatorBot} />}
      {treeBot && <FlowTreeModal open={!!treeBot} onClose={() => setTreeBot(null)} bot={treeBot} />}
    </div>
  );
}
