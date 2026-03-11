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

// ─── Goto Selector (reusable) ───
function GotoSelector({
  gotoType,
  gotoTarget,
  onTypeChange,
  onTargetChange,
  keywords,
  menus,
  label,
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
    <div>
      {label && <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 block">{label}</label>}
      <div className="grid grid-cols-2 gap-2">
        <select value={gotoType} onChange={(e) => { onTypeChange(e.target.value as GotoTarget['type'] | ''); onTargetChange(''); }} className={inputClass}>
          <option value="">Sem goto</option>
          <option value="MENU">Goto Menu</option>
          <option value="KEYWORD">Goto Keyword</option>
        </select>
        {gotoType ? (
          <select value={gotoTarget} onChange={(e) => onTargetChange(e.target.value)} className={inputClass}>
            <option value="">Selecione...</option>
            {gotoType === 'MENU'
              ? (targets as InteractiveMenu[]).map((t) => (
                  <option key={t.trigger} value={t.trigger}>
                    {t.trigger} — {t.title}
                  </option>
                ))
              : (targets as Keyword[]).map((t) => (
                  <option key={t.trigger} value={t.trigger}>
                    {t.trigger} → {t.response.substring(0, 40)}{t.response.length > 40 ? '...' : ''}
                  </option>
                ))
            }
          </select>
        ) : (
          <div className="px-4 py-3 rounded-xl bg-[var(--color-bg-input)] border border-[var(--color-border)] text-sm text-[var(--color-text-muted)]">
            Sem navegação
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Create/Edit Bot Modal ───
function BotFormModal({ open, onClose, bot }: { open: boolean; onClose: () => void; bot?: Bot | null }) {
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({
    defaultValues: {
      name: bot?.name || '',
      responseMode: bot?.responseMode || 'KEYWORDS',
      systemPrompt: bot?.systemPrompt || '',
      aiConfigId: bot?.aiConfigId || '',
    },
  });
  const { createBot, updateBot } = useBotStore();
  const [saving, setSaving] = useState(false);
  const [aiConfigs, setAiConfigs] = useState<any[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [menus, setMenus] = useState<InteractiveMenu[]>([]);
  const responseMode = watch('responseMode');

  // Initial interaction state
  const [initType, setInitType] = useState<GotoTarget['type'] | ''>(
    bot?.flowConfig?.initialInteraction?.type || ''
  );
  const [initTarget, setInitTarget] = useState(
    bot?.flowConfig?.initialInteraction?.target || ''
  );

  // Fallback state
  const [fallbackMsg, setFallbackMsg] = useState(bot?.flowConfig?.fallback?.message || '');
  const [fallbackGotoType, setFallbackGotoType] = useState<GotoTarget['type'] | ''>(
    bot?.flowConfig?.fallback?.goto?.type || ''
  );
  const [fallbackGotoTarget, setFallbackGotoTarget] = useState(
    bot?.flowConfig?.fallback?.goto?.target || ''
  );

  useEffect(() => {
    reset({
      name: bot?.name || '',
      responseMode: bot?.responseMode || 'KEYWORDS',
      systemPrompt: bot?.systemPrompt || '',
      aiConfigId: bot?.aiConfigId || '',
    });
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

      if (initType && initTarget) {
        flowConfig.initialInteraction = { type: initType, target: initTarget };
      }

      if (fallbackMsg.trim()) {
        flowConfig.fallback = {
          message: fallbackMsg.trim(),
          goto: fallbackGotoType && fallbackGotoTarget
            ? { type: fallbackGotoType, target: fallbackGotoTarget }
            : undefined,
        };
      }

      const payload = {
        name: data.name,
        responseMode: data.responseMode,
        systemPrompt: data.systemPrompt || undefined,
        initialMessage: undefined,
        aiConfigId: data.aiConfigId || null,
        flowConfig: Object.keys(flowConfig).length > 0 ? flowConfig : undefined,
      };

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
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Nome do Bot" error={errors.name?.message}>
            <input {...register('name', { required: 'Nome obrigatório' })} placeholder="Ex: Atendimento" className={inputClass} />
          </FormField>
          <FormField label="Modo de resposta">
            <select {...register('responseMode')} className={inputClass}>
              <option value="KEYWORDS">Keywords</option>
              <option value="AI">I.A.</option>
              <option value="HYBRID">Hibrido</option>
            </select>
          </FormField>
        </div>

        {(responseMode === 'AI' || responseMode === 'HYBRID') && (
          <FormField label="Configuração de I.A.">
            <select {...register('aiConfigId')} className={inputClass}>
              <option value="">Padrão do sistema (sem config personalizada)</option>
              {aiConfigs.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.provider} - {c.model})
                </option>
              ))}
            </select>
          </FormField>
        )}

        <div className="p-4 rounded-xl bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] mb-5">
          <label className="text-sm font-medium text-[var(--color-text-primary)] mb-3 block flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-[var(--color-accent)]" />
            Primeira interação do bot
          </label>
          <p className="text-xs text-[var(--color-text-muted)] mb-3">
            Escolha qual keyword ou menu interativo sera enviado quando o usuario iniciar a conversa.
          </p>
          {bot ? (
            <GotoSelector
              gotoType={initType}
              gotoTarget={initTarget}
              onTypeChange={setInitType}
              onTargetChange={setInitTarget}
              keywords={keywords}
              menus={menus}
            />
          ) : (
            <p className="text-xs text-[var(--color-text-muted)] italic">
              Salve o bot primeiro e depois configure a primeira interação (precisa ter keywords/menus criados).
            </p>
          )}
        </div>

        <FormField label="System Prompt (IA)">
          <textarea {...register('systemPrompt')} placeholder="Instruções para a IA..." rows={3} className={inputClass + ' resize-none'} />
        </FormField>

        <div className="p-4 rounded-xl bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] mb-5">
          <label className="text-sm font-medium text-[var(--color-text-secondary)] mb-3 block">Fallback (quando algo falha)</label>
          <FormField label="Mensagem de fallback">
            <input value={fallbackMsg} onChange={(e) => setFallbackMsg(e.target.value)} placeholder="Desculpe, ocorreu um erro..." className={inputClass} />
          </FormField>
          {bot && (
            <GotoSelector
              gotoType={fallbackGotoType}
              gotoTarget={fallbackGotoTarget}
              onTypeChange={setFallbackGotoType}
              onTargetChange={setFallbackGotoTarget}
              keywords={keywords}
              menus={menus}
              label="Goto após fallback"
            />
          )}
        </div>

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
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [menus, setMenus] = useState<InteractiveMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const { register, handleSubmit, reset } = useForm({ defaultValues: { trigger: '', response: '', priority: 0 } });

  // Goto state for new keyword
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
    <Modal open={open} onClose={onClose} title={`Keywords - ${bot.name}`} wide>
      <p className="text-xs text-[var(--color-text-muted)] mb-5">
        Matching case-insensitive. Use goto para direcionar o bot a outro fluxo após a resposta.
      </p>
      <form onSubmit={handleSubmit(onAdd)} className="space-y-3 mb-6">
        <div className="flex gap-3">
          <input {...register('trigger', { required: true })} placeholder="Palavra-chave" className={inputClass + ' flex-1'} />
          <input {...register('response', { required: true })} placeholder="Resposta do bot" className={inputClass + ' flex-1'} />
        </div>
        <GotoSelector
          gotoType={gotoType}
          gotoTarget={gotoTarget}
          onTypeChange={setGotoType}
          onTargetChange={setGotoTarget}
          keywords={keywords}
          menus={menus}
          label="Goto (navegação após resposta)"
        />
        <div className="flex justify-end">
          <button type="submit" className={btnPrimary + ' shrink-0 justify-center'}>
            <Plus className="w-4 h-4" /> Adicionar
          </button>
        </div>
      </form>
      <div className="space-y-2.5 max-h-[350px] overflow-y-auto">
        {loading ? <p className="text-sm text-[var(--color-text-muted)]">Carregando...</p> :
          keywords.length === 0 ? <p className="text-sm text-[var(--color-text-muted)] text-center py-8">Nenhuma keyword cadastrada.</p> :
          keywords.map((kw) => (
            <div key={kw.id} className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-bg-tertiary)]">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-[var(--color-accent)] shrink-0">{kw.trigger}</span>
                  <span className="text-[var(--color-text-muted)] shrink-0">→</span>
                  <span className="text-sm text-[var(--color-text-secondary)] truncate">{kw.response}</span>
                </div>
                {kw.goto && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <ArrowRight className="w-3 h-3 text-blue-400" />
                    <span className="text-xs text-blue-400">goto {kw.goto.type.toLowerCase()}: {kw.goto.target}</span>
                  </div>
                )}
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
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const { register, handleSubmit, reset } = useForm({
    defaultValues: { trigger: '', title: '', body: '', footer: '' },
  });
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
      const [menusData, keywordsData] = await Promise.all([
        api.getMenus(bot.id),
        api.getKeywords(bot.id),
      ]);
      setMenus(menusData);
      setKeywords(keywordsData);
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { if (open) load(); }, [open]);

  const addOption = () => {
    if (!optTitle.trim()) return;

    const goto = optGotoType && optGotoTarget.trim()
      ? { type: optGotoType, target: optGotoTarget.trim() }
      : undefined;

    setOptions([...options, { id: `opt_${Date.now()}`, title: optTitle.trim(), description: optDesc.trim() || undefined, goto }]);
    setOptTitle('');
    setOptDesc('');
    setOptGotoType('');
    setOptGotoTarget('');
  };

  const removeOption = (id: string) => setOptions(options.filter((o) => o.id !== id));

  const onSubmitMenu = async (data: any) => {
    if (options.length === 0) return;

    const payload = {
      trigger: data.trigger,
      title: data.title,
      body: data.body || undefined,
      footer: data.footer || undefined,
      options,
    };

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
    reset({
      trigger: menu.trigger,
      title: menu.title,
      body: menu.body || '',
      footer: menu.footer || '',
    });
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
    <Modal open={open} onClose={onClose} title={`Menus Interativos - ${bot.name}`} wide>
      {showAdd ? (
        <form onSubmit={handleSubmit(onSubmitMenu)}>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <FormField label="Trigger (palavra-chave)">
              <input {...register('trigger', { required: true })} placeholder="Ex: menu, opções" className={inputClass} />
            </FormField>
            <FormField label="Titulo do menu">
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
            <div className="grid grid-cols-5 gap-3 mb-3">
              <input value={optTitle} onChange={(e) => setOptTitle(e.target.value)} placeholder="Titulo da opção" className={inputClass + ' col-span-2'} />
              <input value={optDesc} onChange={(e) => setOptDesc(e.target.value)} placeholder="Descrição (opcional)" className={inputClass + ' col-span-2'} />
              <button type="button" onClick={addOption} className={btnPrimary + ' shrink-0 justify-center'}><Plus className="w-4 h-4" /></button>
            </div>
            <GotoSelector
              gotoType={optGotoType}
              gotoTarget={optGotoTarget}
              onTypeChange={setOptGotoType}
              onTargetChange={setOptGotoTarget}
              keywords={keywords}
              menus={menus}
              label="Goto da opção (navegação após seleção)"
            />
            <div className="space-y-2 max-h-[200px] overflow-y-auto mt-3">
              {options.map((opt, i) => (
                <div key={opt.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-tertiary)]">
                  <span className="text-sm text-[var(--color-text-primary)]">
                    <strong className="text-[var(--color-accent)]">{i + 1}.</strong> {opt.title}
                    {opt.description && <span className="text-[var(--color-text-muted)] ml-2">- {opt.description}</span>}
                    {opt.goto && <span className="text-blue-400 ml-2">→ {opt.goto.type}:{opt.goto.target}</span>}
                  </span>
                  <button type="button" onClick={() => removeOption(opt.id)} className="text-red-400 hover:text-red-300 p-1 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              {options.length === 0 && <p className="text-xs text-[var(--color-text-muted)] text-center py-4">Adicione pelo menos uma opção ao menu</p>}
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={() => { setShowAdd(false); resetFormState(); }} className={btnSecondary}>Cancelar</button>
            <button type="submit" disabled={options.length === 0} className={btnPrimary}>{editingMenuId ? 'Salvar alterações' : 'Criar Menu'}</button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex justify-end mb-5">
            <button onClick={() => { resetFormState(); setShowAdd(true); }} className={btnPrimary}><Plus className="w-4 h-4" /> Novo Menu</button>
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
                    <div className="flex items-center gap-1">
                      <button onClick={() => onStartEditMenu(menu)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer p-2 rounded-lg hover:bg-[var(--color-bg-hover)] transition-all"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => onDeleteMenu(menu.id)} className="text-red-400 hover:text-red-300 cursor-pointer p-2 rounded-lg hover:bg-red-500/10 transition-all"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {(menu.options || []).map((opt, i) => (
                      <div key={opt.id} className="text-xs text-[var(--color-text-secondary)] pl-3">
                        <span className="text-[var(--color-accent)]">{i + 1}.</span> {opt.title}
                        {opt.description && <span className="text-[var(--color-text-muted)]"> - {opt.description}</span>}
                        {opt.goto && <span className="text-blue-400"> → {opt.goto.type}:{opt.goto.target}</span>}
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
      toast.success('WhatsApp conectado com sucesso!');
      onClose();
    } catch (err) {
      toast.error(`Erro ao conectar WhatsApp: ${extractApiError(err)}`);
    } finally { setSaving(false); }
  };

  const onDisconnect = async () => {
    try {
      await api.deleteWhatsappChannel(bot.id);
      await fetchBots();
      toast.success('WhatsApp desconectado!');
      onClose();
    } catch (err) {
      toast.error(`Erro ao desconectar WhatsApp: ${extractApiError(err)}`);
    }
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
          <FormField label="Numero WhatsApp" error={errors.phoneNumber?.message}>
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

// ─── Flow Tree Visualization ───
interface TreeNode {
  id: string;
  label: string;
  type: 'initial' | 'keyword' | 'menu' | 'option' | 'fallback';
  children: TreeNode[];
  gotoLabel?: string;
}

function buildFlowTree(bot: Bot, keywords: Keyword[], menus: InteractiveMenu[]): TreeNode {
  // pathVisited: rastreia apenas o caminho atual para detectar ciclos
  // Isso permite que o mesmo menu/keyword seja referenciado em múltiplos lugares (many-to-many)
  const resolveGoto = (goto: GotoTarget, depth: number, pathVisited: Set<string>): TreeNode | null => {
    if (depth > 10) return null;
    const key = `${goto.type}:${goto.target.toLowerCase()}`;

    // Detecta ciclo no caminho atual
    if (pathVisited.has(key)) {
      return {
        id: `loop_${key}_d${depth}`,
        label: `↩ ${goto.target} (referência circular)`,
        type: goto.type === 'MENU' ? 'menu' : 'keyword',
        children: [],
      };
    }

    const nextPath = new Set(pathVisited);
    nextPath.add(key);

    if (goto.type === 'MENU') {
      const menu = menus.find(m => m.trigger.toLowerCase() === goto.target.toLowerCase());
      if (!menu) {
        return {
          id: `menu_missing_${goto.target}_d${depth}`,
          label: `Menu: ${goto.target} (não encontrado)`,
          type: 'menu',
          children: [],
        };
      }

      return {
        id: `menu_${menu.id}_d${depth}`,
        label: `Menu: ${menu.title}`,
        type: 'menu',
        children: (menu.options || []).map((opt, i) => {
          const optNode: TreeNode = {
            id: `opt_${opt.id}_d${depth}_i${i}`,
            label: opt.title,
            type: 'option',
            children: [],
            gotoLabel: opt.goto ? `→ ${opt.goto.type.toLowerCase()}: ${opt.goto.target}` : undefined,
          };
          if (opt.goto) {
            const child = resolveGoto(opt.goto, depth + 1, nextPath);
            if (child) optNode.children.push(child);
          }
          return optNode;
        }),
      };
    }

    if (goto.type === 'KEYWORD') {
      const kw = keywords.find(k => k.trigger.toLowerCase() === goto.target.toLowerCase());
      if (!kw) {
        return {
          id: `kw_missing_${goto.target}_d${depth}`,
          label: `Keyword: ${goto.target} (não encontrada)`,
          type: 'keyword',
          children: [],
        };
      }

      const kwNode: TreeNode = {
        id: `kw_${kw.id}_d${depth}`,
        label: `Keyword: ${kw.trigger}`,
        type: 'keyword',
        children: [],
        gotoLabel: kw.goto ? `→ ${kw.goto.type.toLowerCase()}: ${kw.goto.target}` : undefined,
      };
      if (kw.goto) {
        const child = resolveGoto(kw.goto, depth + 1, nextPath);
        if (child) kwNode.children.push(child);
      }
      return kwNode;
    }

    return null;
  };

  const root: TreeNode = {
    id: 'root',
    label: bot.name,
    type: 'initial',
    children: [],
  };

  const flow = bot.flowConfig;

  // Interação inicial
  if (flow?.initialInteraction) {
    const initNode = resolveGoto(flow.initialInteraction, 0, new Set());
    if (initNode) root.children.push(initNode);
  }

  // Coletar triggers referenciados de qualquer lugar (para filtrar os "standalone")
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

  // Keywords standalone (não referenciadas por ninguém)
  for (const kw of keywords) {
    if (!referencedKeywords.has(kw.trigger.toLowerCase()) && kw.isActive) {
      const kwNode: TreeNode = {
        id: `standalone_kw_${kw.id}`,
        label: `Keyword: ${kw.trigger}`,
        type: 'keyword',
        children: [],
        gotoLabel: kw.goto ? `→ ${kw.goto.type.toLowerCase()}: ${kw.goto.target}` : undefined,
      };
      if (kw.goto) {
        const child = resolveGoto(kw.goto, 0, new Set([`KEYWORD:${kw.trigger.toLowerCase()}`]));
        if (child) kwNode.children.push(child);
      }
      root.children.push(kwNode);
    }
  }

  // Menus standalone (não referenciados por ninguém)
  for (const menu of menus) {
    if (!referencedMenus.has(menu.trigger.toLowerCase()) && menu.isActive) {
      const menuNode = resolveGoto({ type: 'MENU', target: menu.trigger }, 0, new Set());
      if (menuNode) root.children.push(menuNode);
    }
  }

  // Fallback
  if (flow?.fallback) {
    const fbNode: TreeNode = {
      id: 'fallback',
      label: `Fallback: ${flow.fallback.message.substring(0, 40)}${flow.fallback.message.length > 40 ? '...' : ''}`,
      type: 'fallback',
      children: [],
    };
    if (flow.fallback.goto) {
      const child = resolveGoto(flow.fallback.goto, 0, new Set());
      if (child) fbNode.children.push(child);
    }
    root.children.push(fbNode);
  }

  return root;
}

function TreeNodeView({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const colors: Record<TreeNode['type'], string> = {
    initial: 'text-[var(--color-accent)] bg-[var(--color-accent-glow)] border border-[var(--color-accent)]/20',
    keyword: 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20',
    menu: 'text-purple-400 bg-purple-500/10 border border-purple-500/20',
    option: 'text-blue-400 bg-blue-500/10 border border-blue-500/20',
    fallback: 'text-orange-400 bg-orange-500/10 border border-orange-500/20',
  };

  const icons: Record<TreeNode['type'], React.ReactNode> = {
    initial: <BotIcon className="w-3.5 h-3.5" />,
    keyword: <Key className="w-3.5 h-3.5" />,
    menu: <List className="w-3.5 h-3.5" />,
    option: <ChevronRight className="w-3.5 h-3.5" />,
    fallback: <ArrowRight className="w-3.5 h-3.5" />,
  };

  const hasChildren = node.children.length > 0;

  return (
    <div className={depth > 0 ? 'relative ml-6' : ''}>
      {/* Linha vertical de conexão */}
      {depth > 0 && (
        <div className="absolute left-[-16px] top-0 bottom-0 w-px bg-[var(--color-border)]" />
      )}
      {/* Linha horizontal de conexão */}
      {depth > 0 && (
        <div className="absolute left-[-16px] top-[14px] w-4 h-px bg-[var(--color-border)]" />
      )}

      <div className="flex items-start gap-2 py-1.5">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 ${colors[node.type]}`}>
          {icons[node.type]}
          {node.label}
        </span>
        {node.gotoLabel && (
          <span className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-lg mt-0.5 shrink-0">
            {node.gotoLabel}
          </span>
        )}
      </div>

      {hasChildren && (
        <div className="ml-4 relative">
          {/* Linha vertical para os filhos */}
          <div className="absolute left-0 top-0 bottom-0 w-px bg-[var(--color-border)]" style={{ left: '-8px' }} />
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
        <div className="flex items-center justify-center py-12 text-[var(--color-text-muted)]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
        </div>
      ) : tree && tree.children.length > 0 ? (
        <div>
          <p className="text-xs text-[var(--color-text-muted)] mb-4">
            Os nós com <span className="text-blue-400">→ goto</span> são referências many-to-many — um mesmo menu ou keyword pode ser referenciado em múltiplos lugares.
          </p>
          <div className="max-h-[520px] overflow-y-auto overflow-x-auto pr-2 pl-1 pb-2">
            <TreeNodeView node={tree} />
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <GitBranch className="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-3" />
          <p className="text-sm text-[var(--color-text-muted)]">
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const now = () => {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const findMenuByTrigger = (trigger: string): InteractiveMenu | null => {
    const normalized = trigger.toLowerCase().trim();
    return menus.find(m => m.isActive !== false && m.trigger.toLowerCase() === normalized) || null;
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

  const findKeywordByTrigger = (trigger: string): Keyword | null => {
    const normalized = trigger.toLowerCase().trim();
    return keywords.find(k => k.isActive !== false && k.trigger.toLowerCase() === normalized) || null;
  };

  const findKeywordMatch = (text: string): Keyword | null => {
    const normalized = text.toLowerCase().trim();
    const sorted = [...keywords].sort((a, b) => (b.priority || 0) - (a.priority || 0));
    for (const kw of sorted) {
      if (kw.isActive !== false && normalized.includes(kw.trigger.toLowerCase())) {
        return kw;
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

  const addBotMessage = (text: string, isMenu?: boolean, menuOptions?: MenuOption[]) => {
    const botMsg: EmulatorMessage = {
      id: (Date.now() + Math.random()).toString(),
      text,
      direction: 'incoming',
      time: now(),
      isMenu,
      menuOptions,
    };
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
        } else {
          addBotMessage(`Menu "${goto.target}" não encontrado.`);
        }
      } else if (goto.type === 'KEYWORD') {
        const kw = findKeywordByTrigger(goto.target);
        if (kw) {
          addBotMessage(kw.response);
          if (kw.goto) {
            executeGoto(kw.goto, depth + 1);
          }
        } else {
          addBotMessage(`Keyword "${goto.target}" não encontrada.`);
        }
      }
    }, 400 + depth * 300);
  };

  const sendMessage = async (text?: string) => {
    const msgText = text || input.trim();
    if (!msgText) return;
    if (!text) setInput('');

    const isFirst = !initialized;
    setInitialized(true);

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

      // Primeira interação: usar initialInteraction se configurado
      if (isFirst && bot.flowConfig?.initialInteraction) {
        executeGoto(bot.flowConfig.initialInteraction);
        return;
      }

      // Check menus first
      const menuMatch = findMenuMatch(msgText);
      if (menuMatch) {
        const text = `📋 ${menuMatch.title}\n${menuMatch.body || ''}\n\n${(menuMatch.options || []).map((o, i) => `${i + 1}. ${o.title}${o.description ? ' - ' + o.description : ''}`).join('\n')}${menuMatch.footer ? '\n\n' + menuMatch.footer : ''}`;
        addBotMessage(text, true, menuMatch.options);
        return;
      }

      // Check if it's a menu option selection (from any menu)
      for (const menu of menus) {
        const opt = (menu.options || []).find(o =>
          o.title.toLowerCase() === msgText.toLowerCase() ||
          o.id.toLowerCase() === msgText.toLowerCase()
        );
        if (opt) {
          if (opt.goto) {
            addBotMessage(`Você selecionou: ${opt.title}`);
            executeGoto(opt.goto);
          } else {
            addBotMessage(`Você selecionou: ${opt.title}${opt.description ? '\n' + opt.description : ''}`);
          }
          return;
        }
      }

      // Keyword match with goto support
      if (bot.responseMode === 'KEYWORDS' || bot.responseMode === 'HYBRID') {
        const kwMatch = findKeywordMatch(msgText);
        if (kwMatch) {
          addBotMessage(kwMatch.response);
          if (kwMatch.goto) {
            executeGoto(kwMatch.goto);
          }
          return;
        }
        if (bot.responseMode === 'HYBRID') {
          addBotMessage(generateAIResponse(msgText));
          return;
        }
        addBotMessage('Desculpe, não entendi. Tente reformular sua pergunta.');
        return;
      }

      // AI mode
      addBotMessage(generateAIResponse(msgText));
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
              {bot.flowConfig?.initialInteraction && (
                <div className="mt-3 px-3 py-2 rounded-lg bg-[#202c33] text-[#667781] text-[11px]">
                  Primeira interação: {bot.flowConfig.initialInteraction.type.toLowerCase()} → {bot.flowConfig.initialInteraction.target}
                </div>
              )}
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
                    {msg.menuOptions.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => sendMessage(opt.title)}
                        className="w-full text-left px-3 py-2 rounded-lg bg-[#005c4b]/40 hover:bg-[#005c4b]/70 text-[#25d366] text-xs font-medium transition-colors cursor-pointer border border-[#25d366]/20"
                      >
                        {opt.title}
                        {opt.goto && <span className="text-[#25d366]/60 ml-1 text-[10px]">→</span>}
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

// ─── Flow Preview (compact) ───
function buildFlowPreview(bot: Bot): string[] {
  const preview: string[] = [];
  const flow = bot.flowConfig;

  if (flow?.initialInteraction) {
    preview.push(`inicio → ${flow.initialInteraction.type.toLowerCase()}: ${flow.initialInteraction.target}`);
  } else if (bot.initialMessage?.trim()) {
    preview.push(`inicio: ${bot.initialMessage.trim()}`);
  }

  const steps = flow?.steps || [];
  for (const step of steps) {
    if (step.type === 'GOTO_MENU' && step.menuTrigger) {
      preview.push(`goto menu: ${step.menuTrigger}`);
    }
    if (step.type === 'GOTO_KEYWORD' && step.keywordTrigger) {
      preview.push(`goto keyword: ${step.keywordTrigger}`);
    }
  }

  if (flow?.fallback?.goto) {
    preview.push(`fallback → ${flow.fallback.goto.type.toLowerCase()}: ${flow.fallback.goto.target}`);
  }

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
                  {/* Testar / Visualizar */}
                  <button onClick={() => setEmulatorBot(bot)} className="p-2.5 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-all cursor-pointer" title="Testar Bot">
                    <Play className="w-4 h-4" />
                  </button>
                  <button onClick={() => setTreeBot(bot)} className="p-2.5 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-purple-400 transition-all cursor-pointer" title="Árvore do Fluxo">
                    <GitBranch className="w-4 h-4" />
                  </button>

                  {/* Divisor */}
                  <div className="w-px h-6 bg-[var(--color-border)] mx-1" />

                  {/* Ativar/Desativar */}
                  <button onClick={() => toggleActive(bot)} className="p-2.5 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-all cursor-pointer" title={bot.isActive ? 'Desativar' : 'Ativar'}>
                    {bot.isActive ? <Power className="w-4 h-4 text-green-400" /> : <PowerOff className="w-4 h-4" />}
                  </button>

                  {/* Divisor */}
                  <div className="w-px h-6 bg-[var(--color-border)] mx-1" />

                  {/* Configurar conteúdo */}
                  <button onClick={() => setKwBot(bot)} className="p-2.5 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-emerald-400 transition-all cursor-pointer" title="Keywords">
                    <Key className="w-4 h-4" />
                  </button>
                  <button onClick={() => setMenuBot(bot)} className="p-2.5 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-blue-400 transition-all cursor-pointer" title="Menus Interativos">
                    <List className="w-4 h-4" />
                  </button>
                  <button onClick={() => setWaBot(bot)} className="p-2.5 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-green-400 transition-all cursor-pointer" title="WhatsApp">
                    <Phone className="w-4 h-4" />
                  </button>

                  {/* Divisor */}
                  <div className="w-px h-6 bg-[var(--color-border)] mx-1" />

                  {/* Editar / Excluir */}
                  <button onClick={() => { setEditBot(bot); setShowForm(true); }} className="p-2.5 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-all cursor-pointer" title="Editar">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={async () => { try { await deleteBot(bot.id); toast.success(`Bot "${bot.name}" excluído!`); } catch (err) { toast.error(`Erro ao excluir bot: ${extractApiError(err)}`); } }} className="p-2.5 rounded-lg hover:bg-red-500/10 text-[var(--color-text-muted)] hover:text-red-400 transition-all cursor-pointer" title="Excluir">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-5 mt-4 text-xs text-[var(--color-text-muted)]">
                <span className="flex items-center gap-1.5"><Key className="w-3.5 h-3.5" /> {bot._count?.keywords || 0} keywords</span>
                <span className="flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> {bot._count?.conversations || 0} conversas</span>
              </div>

              {buildFlowPreview(bot).length > 0 && (
                <div className="mt-4 p-3 rounded-xl bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]">
                  <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-2 flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5" /> Fluxo
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] break-words">
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
