import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useBotStore, type Bot } from '@/stores/bot.store';
import { api, extractApiError, type InteractiveMenu, type MenuOption, type FlowConfig, type GotoTarget, type Keyword, type CaptureVariable, type BotIteration, type BotKnowledge } from '@/services/api';
import { toast } from 'sonner';
import {
  Plus, Trash2, Pencil, Zap, Key, X, Power, PowerOff,
  MessageSquare, Bot as BotIcon, Phone, Loader2, Send,
  Play, ArrowLeft, Check, CheckCheck, List, Cpu,
  GitBranch, ChevronRight, ArrowRight, Database, RotateCcw, Copy,
  Repeat, FileText, Link as LinkIcon, File, Variable,
  GripVertical, BookOpen, Upload, Sparkles,
} from 'lucide-react';
import './BotsPage.css';

// ─── Collect all bot variables ───
interface BotVariable {
  name: string;
  type: string;
  source: string; // e.g. "iteração: Boas-vindas", "keyword: oi", "menu: principal"
}

function collectBotVariables(
  iterations: BotIteration[],
  keywords: Keyword[],
  menus: InteractiveMenu[],
): BotVariable[] {
  const vars: BotVariable[] = [];
  const seen = new Set<string>();

  for (const iter of iterations) {
    if (iter.type === 'CAPTURE_VARIABLE') {
      const c = iter.content as any;
      if (c.name && !seen.has(c.name)) {
        seen.add(c.name);
        vars.push({ name: c.name, type: c.variableType || 'STRING', source: `iteração: ${iter.name}` });
      }
    }
  }

  for (const kw of keywords) {
    if (kw.captureVariable?.name && !seen.has(kw.captureVariable.name)) {
      seen.add(kw.captureVariable.name);
      vars.push({ name: kw.captureVariable.name, type: kw.captureVariable.type, source: `keyword: ${kw.trigger}` });
    }
  }

  for (const menu of menus) {
    if (menu.captureVariable?.name && !seen.has(menu.captureVariable.name)) {
      seen.add(menu.captureVariable.name);
      vars.push({ name: menu.captureVariable.name, type: menu.captureVariable.type, source: `menu: ${menu.trigger}` });
    }
  }

  return vars;
}

// ─── Variable Autocomplete Input ───
function VariableInput({
  value,
  onChange,
  variables,
  multiline,
  placeholder,
  rows,
  className,
  style,
}: {
  value: string;
  onChange: (val: string) => void;
  variables: BotVariable[];
  multiline?: boolean;
  placeholder?: string;
  rows?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [filter, setFilter] = useState('');
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const varTriggerIndex = useRef<number>(-1);

  const filteredVars = useMemo(() => {
    if (!filter) return variables;
    const lower = filter.toLowerCase();
    return variables.filter(v => v.name.toLowerCase().includes(lower));
  }, [variables, filter]);

  const closeDropdown = useCallback(() => {
    setShowDropdown(false);
    setFilter('');
    setSelectedIndex(0);
    varTriggerIndex.current = -1;
  }, []);

  const insertVariable = useCallback((varName: string) => {
    const triggerStart = varTriggerIndex.current;
    if (triggerStart < 0) return;

    const el = inputRef.current;
    const cursorPos = el?.selectionStart ?? value.length;
    const before = value.substring(0, triggerStart);
    const after = value.substring(cursorPos);
    const newValue = before + `{{${varName}}}` + after;
    onChange(newValue);
    closeDropdown();

    // Restore cursor position after React re-render
    const newCursorPos = before.length + varName.length + 4; // 4 = {{ }}
    requestAnimationFrame(() => {
      if (el) {
        el.selectionStart = newCursorPos;
        el.selectionEnd = newCursorPos;
        el.focus();
      }
    });
  }, [value, onChange, closeDropdown]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    const cursorPos = e.target.selectionStart ?? newValue.length;
    // Look backwards from cursor for /var pattern
    const textBeforeCursor = newValue.substring(0, cursorPos);
    const varMatch = textBeforeCursor.match(/\/var(\w*)$/);

    if (varMatch) {
      varTriggerIndex.current = cursorPos - varMatch[0].length;
      setFilter(varMatch[1] || '');
      setSelectedIndex(0);

      // Calculate dropdown position
      const el = e.target;
      const rect = el.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (containerRect) {
        setDropdownPos({
          top: rect.bottom - containerRect.top + 4,
          left: 0,
        });
      }

      setShowDropdown(true);
    } else {
      if (showDropdown) closeDropdown();
    }
  }, [onChange, showDropdown, closeDropdown]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showDropdown || filteredVars.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredVars.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredVars.length) % filteredVars.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertVariable(filteredVars[selectedIndex].name);
    } else if (e.key === 'Escape') {
      closeDropdown();
    }
  }, [showDropdown, filteredVars, selectedIndex, insertVariable, closeDropdown]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDropdown, closeDropdown]);

  const sharedProps = {
    ref: inputRef as any,
    value,
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    placeholder,
    className: className || 'form-input',
    style,
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {multiline ? (
        <textarea {...sharedProps} rows={rows || 3} className={`${sharedProps.className} form-textarea`} />
      ) : (
        <input {...sharedProps} />
      )}
      {showDropdown && filteredVars.length > 0 && (
        <div className="var-dropdown" style={{ top: dropdownPos.top, left: dropdownPos.left }}>
          <div className="var-dropdown__header">
            <Variable size={12} />
            <span>Variáveis disponíveis</span>
          </div>
          {filteredVars.map((v, i) => (
            <div
              key={v.name}
              className={`var-dropdown__item${i === selectedIndex ? ' var-dropdown__item--active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); insertVariable(v.name); }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <span className="var-dropdown__item-name">{`{{${v.name}}}`}</span>
              <span className="var-dropdown__item-meta">{v.type} &middot; {v.source}</span>
            </div>
          ))}
        </div>
      )}
      {showDropdown && filteredVars.length === 0 && (
        <div className="var-dropdown" style={{ top: dropdownPos.top, left: dropdownPos.left }}>
          <div className="var-dropdown__empty">Nenhuma variável encontrada</div>
        </div>
      )}
    </div>
  );
}

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
  gotoType, gotoTarget, onTypeChange, onTargetChange, keywords, menus, iterations, label, showIteration, showLastInteraction,
}: {
  gotoType: GotoTarget['type'] | '';
  gotoTarget: string;
  onTypeChange: (v: GotoTarget['type'] | '') => void;
  onTargetChange: (v: string) => void;
  keywords: Keyword[];
  menus: InteractiveMenu[];
  iterations?: BotIteration[];
  label?: string;
  showIteration?: boolean;
  showLastInteraction?: boolean;
}) {
  const activeIterations = (iterations || []).filter(i => i.isActive !== false).sort((a, b) => a.order - b.order);

  return (
    <div className="goto-selector">
      {label && <label className="goto-selector__label">{label}</label>}
      <div className="goto-selector__row">
        <select
          value={gotoType}
          onChange={(e) => {
            const val = e.target.value as GotoTarget['type'] | '';
            onTypeChange(val);
            if (val === 'LAST_INTERACTION') {
              onTargetChange('_auto');
            } else {
              onTargetChange('');
            }
          }}
          className="form-input"
        >
          <option value="">Sem goto</option>
          <option value="MENU">Goto Menu</option>
          <option value="KEYWORD">Goto Keyword</option>
          {showIteration && <option value="ITERATION">Goto Iteração</option>}
          {showLastInteraction && <option value="LAST_INTERACTION">Última Interação (encerrar)</option>}
        </select>
        {gotoType === 'MENU' || gotoType === 'KEYWORD' ? (
          <select value={gotoTarget} onChange={(e) => onTargetChange(e.target.value)} className="form-input">
            <option value="">Selecione...</option>
            {gotoType === 'MENU'
              ? menus.filter(m => m.isActive !== false).map((t) => (
                  <option key={t.trigger} value={t.trigger}>{t.trigger} — {t.title}</option>
                ))
              : keywords.filter(k => k.isActive !== false).map((t) => (
                  <option key={t.trigger} value={t.trigger}>{t.trigger} → {t.response.substring(0, 40)}{t.response.length > 40 ? '...' : ''}</option>
                ))
            }
          </select>
        ) : gotoType === 'ITERATION' ? (
          <select value={gotoTarget} onChange={(e) => onTargetChange(e.target.value)} className="form-input">
            <option value="">Selecione uma iteração...</option>
            {activeIterations.map((iter) => (
              <option key={iter.id} value={iter.id}>{iter.name} ({ITERATION_TYPES.find(t => t.value === iter.type)?.label || iter.type})</option>
            ))}
          </select>
        ) : gotoType === 'LAST_INTERACTION' ? (
          <div className="goto-selector__placeholder" style={{ color: '#f87171', fontSize: 12 }}>Executará a última interação e encerrará</div>
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
  const [iterations, setIterations] = useState<BotIteration[]>([]);
  const responseMode = watch('responseMode');

  const [initType, setInitType] = useState<GotoTarget['type'] | ''>(bot?.flowConfig?.initialInteraction?.type || '');
  const [initTarget, setInitTarget] = useState(bot?.flowConfig?.initialInteraction?.target || '');
  const [lastType, setLastType] = useState<GotoTarget['type'] | ''>(bot?.flowConfig?.lastInteraction?.type || '');
  const [lastTarget, setLastTarget] = useState(bot?.flowConfig?.lastInteraction?.target || '');
  const [fallbackMsg, setFallbackMsg] = useState(bot?.flowConfig?.fallback?.message || '');
  const [fallbackGotoType, setFallbackGotoType] = useState<GotoTarget['type'] | ''>(bot?.flowConfig?.fallback?.goto?.type || '');
  const [fallbackGotoTarget, setFallbackGotoTarget] = useState(bot?.flowConfig?.fallback?.goto?.target || '');

  useEffect(() => {
    reset({ name: bot?.name || '', responseMode: bot?.responseMode || 'KEYWORDS', systemPrompt: bot?.systemPrompt || '', aiConfigId: bot?.aiConfigId || '' });
    setInitType(bot?.flowConfig?.initialInteraction?.type || '');
    setInitTarget(bot?.flowConfig?.initialInteraction?.target || '');
    setLastType(bot?.flowConfig?.lastInteraction?.type || '');
    setLastTarget(bot?.flowConfig?.lastInteraction?.target || '');
    setFallbackMsg(bot?.flowConfig?.fallback?.message || '');
    setFallbackGotoType(bot?.flowConfig?.fallback?.goto?.type || '');
    setFallbackGotoTarget(bot?.flowConfig?.fallback?.goto?.target || '');
  }, [bot, reset]);

  useEffect(() => {
    if (open) {
      api.getAiConfigs().then(setAiConfigs).catch(() => setAiConfigs([]));
      if (bot) {
        Promise.all([
          api.getKeywords(bot.id),
          api.getMenus(bot.id),
          api.getIterations(bot.id),
        ]).then(([kws, mns, iters]) => {
          setKeywords(kws);
          setMenus(mns);
          setIterations(iters);
        }).catch(() => {
          setKeywords([]);
          setMenus([]);
          setIterations([]);
        });
      }
    }
  }, [open, bot]);

  const onSubmit = async (data: any) => {
    setSaving(true);
    try {
      const flowConfig: FlowConfig = {};
      if (initType && initTarget) flowConfig.initialInteraction = { type: initType, target: initTarget };
      if (lastType && lastTarget) flowConfig.lastInteraction = { type: lastType, target: lastTarget };
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
            Escolha qual keyword, menu ou iteração será enviado quando o usuário iniciar a conversa.
          </p>
          {bot ? (
            <GotoSelector gotoType={initType} gotoTarget={initTarget} onTypeChange={setInitType} onTargetChange={setInitTarget} keywords={keywords} menus={menus} iterations={iterations} showIteration />
          ) : (
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              Salve o bot primeiro e depois configure a primeira interação.
            </p>
          )}
        </div>

        <div className="bot-form__section">
          <label className="bot-form__section-label">
            <ArrowRight size={15} color="#f87171" /> Última interação do bot
          </label>
          <p className="bot-form__section-hint">
            Escolha qual keyword, menu ou iteração será enviado como despedida. Ao finalizar, o bot encerra o canal com o contato.
            O diálogo só reinicia se o contato enviar uma nova mensagem.
          </p>
          {bot ? (
            <GotoSelector gotoType={lastType} gotoTarget={lastTarget} onTypeChange={setLastType} onTargetChange={setLastTarget} keywords={keywords} menus={menus} iterations={iterations} showIteration />
          ) : (
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              Salve o bot primeiro e depois configure a última interação.
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
            <GotoSelector gotoType={fallbackGotoType} gotoTarget={fallbackGotoTarget} onTypeChange={setFallbackGotoType} onTargetChange={setFallbackGotoTarget} keywords={keywords} menus={menus} iterations={iterations} label="Goto após fallback" showIteration showLastInteraction />
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
  const [iterations, setIterations] = useState<BotIteration[]>([]);
  const [loading, setLoading] = useState(true);
  const { register, handleSubmit, reset, setValue, watch } = useForm({ defaultValues: { trigger: '', response: '', priority: 0 } });
  const responseValue = watch('response');
  const [gotoType, setGotoType] = useState<GotoTarget['type'] | ''>('');
  const [gotoTarget, setGotoTarget] = useState('');
  const [captureEnabled, setCaptureEnabled] = useState(false);
  const [captureName, setCaptureName] = useState('');
  const [captureType, setCaptureType] = useState<CaptureVariable['type']>('STRING');
  const [capturePrompt, setCapturePrompt] = useState('');

  const botVariables = useMemo(() => collectBotVariables(iterations, keywords, menus), [iterations, keywords, menus]);

  const load = async () => {
    setLoading(true);
    try {
      const [kws, mns, iters] = await Promise.all([api.getKeywords(bot.id), api.getMenus(bot.id), api.getIterations(bot.id)]);
      setKeywords(kws);
      setMenus(mns);
      setIterations(iters);
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { if (open) load(); }, [open]);

  const onAdd = async (data: any) => {
    const goto = gotoType && gotoTarget ? { type: gotoType, target: gotoTarget } : undefined;
    const captureVariable = captureEnabled && captureName.trim()
      ? { name: captureName.trim(), type: captureType, promptMessage: capturePrompt.trim() }
      : undefined;
    try {
      await api.createKeyword(bot.id, { ...data, priority: Number(data.priority) || 0, goto, captureVariable });
      toast.success('Keyword adicionada!');
      reset();
      setGotoType('');
      setGotoTarget('');
      setCaptureEnabled(false);
      setCaptureName('');
      setCaptureType('STRING');
      setCapturePrompt('');
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
          <div style={{ flex: 1 }}>
            <VariableInput
              value={responseValue}
              onChange={(val) => setValue('response', val, { shouldValidate: true })}
              variables={botVariables}
              placeholder="Resposta do bot (use /var para inserir variáveis)"
              className="form-input"
            />
          </div>
        </div>
        <GotoSelector gotoType={gotoType} gotoTarget={gotoTarget} onTypeChange={setGotoType} onTargetChange={setGotoTarget} keywords={keywords} menus={menus} label="Goto (navegação após resposta)" showIteration showLastInteraction />


        <div className="capture-section">
          <label className="capture-toggle">
            <input type="checkbox" className="capture-toggle__checkbox" checked={captureEnabled} onChange={(e) => setCaptureEnabled(e.target.checked)} />
            <Zap size={14} color="#f59e0b" />
            <span className="capture-toggle__label">Capturar variável</span>
          </label>
          {captureEnabled && (
            <div className="capture-fields">
              <div className="form-row">
                <FormField label="Nome da variável">
                  <input className="form-input" placeholder="Ex: cpf, email, nome" value={captureName} onChange={(e) => setCaptureName(e.target.value)} />
                </FormField>
                <FormField label="Tipo">
                  <select className="form-input" value={captureType} onChange={(e) => setCaptureType(e.target.value as CaptureVariable['type'])}>
                    <option value="STRING">Texto (STRING)</option>
                    <option value="NUMBER">Número (NUMBER)</option>
                    <option value="BOOLEAN">Sim/Não (BOOLEAN)</option>
                    <option value="DATE">Data (DATE)</option>
                  </select>
                </FormField>
              </div>
              <FormField label="Mensagem de prompt">
                <input className="form-input" placeholder="Ex: Por favor, digite seu CPF" value={capturePrompt} onChange={(e) => setCapturePrompt(e.target.value)} />
              </FormField>
            </div>
          )}
        </div>

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
              {kw.captureVariable && (
                <div className="keyword-row__goto" style={{ color: '#f59e0b' }}>
                  <Zap size={11} /> captura: {kw.captureVariable.name} ({kw.captureVariable.type})
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
  const [iterations, setIterations] = useState<BotIteration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const { register, handleSubmit, reset, setValue, watch } = useForm({ defaultValues: { trigger: '', title: '', body: '', footer: '' } });
  const bodyValue = watch('body');
  const [options, setOptions] = useState<MenuOption[]>([]);
  const [optTitle, setOptTitle] = useState('');
  const [optDesc, setOptDesc] = useState('');
  const [optGotoType, setOptGotoType] = useState<GotoTarget['type'] | ''>('');
  const [optGotoTarget, setOptGotoTarget] = useState('');
  const [menuCaptureEnabled, setMenuCaptureEnabled] = useState(false);
  const [menuCaptureName, setMenuCaptureName] = useState('');
  const [menuCaptureType, setMenuCaptureType] = useState<CaptureVariable['type']>('STRING');
  const [menuCapturePrompt, setMenuCapturePrompt] = useState('');

  const botVariables = useMemo(() => collectBotVariables(iterations, keywords, menus), [iterations, keywords, menus]);

  const resetFormState = () => {
    reset({ trigger: '', title: '', body: '', footer: '' });
    setOptions([]);
    setOptTitle('');
    setOptDesc('');
    setOptGotoType('');
    setOptGotoTarget('');
    setEditingMenuId(null);
    setMenuCaptureEnabled(false);
    setMenuCaptureName('');
    setMenuCaptureType('STRING');
    setMenuCapturePrompt('');
  };

  const load = async () => {
    setLoading(true);
    try {
      const [menusData, keywordsData, itersData] = await Promise.all([api.getMenus(bot.id), api.getKeywords(bot.id), api.getIterations(bot.id)]);
      setMenus(menusData);
      setKeywords(keywordsData);
      setIterations(itersData);
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
    const captureVariable = menuCaptureEnabled && menuCaptureName.trim()
      ? { name: menuCaptureName.trim(), type: menuCaptureType, promptMessage: menuCapturePrompt.trim() }
      : undefined;
    const payload = { trigger: data.trigger, title: data.title, body: data.body || undefined, footer: data.footer || undefined, options, captureVariable };
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
    if (menu.captureVariable) {
      setMenuCaptureEnabled(true);
      setMenuCaptureName(menu.captureVariable.name);
      setMenuCaptureType(menu.captureVariable.type);
      setMenuCapturePrompt(menu.captureVariable.promptMessage);
    } else {
      setMenuCaptureEnabled(false);
      setMenuCaptureName('');
      setMenuCaptureType('STRING');
      setMenuCapturePrompt('');
    }
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
              <VariableInput
                value={bodyValue}
                onChange={(val) => setValue('body', val)}
                variables={botVariables}
                placeholder="Escolha uma opção abaixo (use /var para variáveis)"
                className="form-input"
              />
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
            <GotoSelector gotoType={optGotoType} gotoTarget={optGotoTarget} onTypeChange={setOptGotoType} onTargetChange={setOptGotoTarget} keywords={keywords} menus={menus} label="Goto da opção (navegação após seleção)" showIteration showLastInteraction />
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

          <div className="capture-section">
            <label className="capture-toggle">
              <input type="checkbox" className="capture-toggle__checkbox" checked={menuCaptureEnabled} onChange={(e) => setMenuCaptureEnabled(e.target.checked)} />
              <Zap size={14} color="#f59e0b" />
              <span className="capture-toggle__label">Capturar variável após exibir menu</span>
            </label>
            {menuCaptureEnabled && (
              <div className="capture-fields">
                <div className="form-row">
                  <FormField label="Nome da variável">
                    <input className="form-input" placeholder="Ex: cpf, email, nome" value={menuCaptureName} onChange={(e) => setMenuCaptureName(e.target.value)} />
                  </FormField>
                  <FormField label="Tipo">
                    <select className="form-input" value={menuCaptureType} onChange={(e) => setMenuCaptureType(e.target.value as CaptureVariable['type'])}>
                      <option value="STRING">Texto (STRING)</option>
                      <option value="NUMBER">Número (NUMBER)</option>
                      <option value="BOOLEAN">Sim/Não (BOOLEAN)</option>
                      <option value="DATE">Data (DATE)</option>
                    </select>
                  </FormField>
                </div>
                <FormField label="Mensagem de prompt">
                  <input className="form-input" placeholder="Ex: Por favor, digite seu CPF" value={menuCapturePrompt} onChange={(e) => setMenuCapturePrompt(e.target.value)} />
                </FormField>
              </div>
            )}
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
                {menu.captureVariable && (
                  <div style={{ marginTop: 6, fontSize: 12, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Zap size={11} /> Captura: {menu.captureVariable.name} ({menu.captureVariable.type})
                  </div>
                )}
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
    },
  });
  const [saving, setSaving] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<string | null>(null);
  const [globalInstance, setGlobalInstance] = useState<{ instanceName: string; status: string } | null>(null);
  const [loadingInstance, setLoadingInstance] = useState(false);
  const { fetchBots } = useBotStore();
  const hasChannel = !!bot.whatsappChannel;
  const provider = watch('provider');

  // Carregar instância global do usuário quando o modal abre
  useEffect(() => {
    if (open && !hasChannel) {
      setLoadingInstance(true);
      api.getConfigInstance()
        .then((res: any) => {
          setGlobalInstance(res?.instance || null);
        })
        .catch(() => setGlobalInstance(null))
        .finally(() => setLoadingInstance(false));
    }
  }, [open, hasChannel]);

  const onSubmit = async (data: any) => {
    setSaving(true);
    try {
      const payload: any = {
        phoneNumber: data.phoneNumber,
        provider: data.provider,
      };
      if (data.provider === 'DIALOG360') {
        payload.dialog360ApiKey = data.dialog360ApiKey;
      }
      // Para EVOLUTION, o backend usará a instância global automaticamente
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
          toast.success('Canal criado! Use o QR Code na página Configuração para conectar.');
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
              {loadingInstance ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
                  <Loader2 size={14} className="animate-spin" /> Carregando instância...
                </div>
              ) : globalInstance ? (
                <div style={{ padding: '10px 12px', background: 'rgba(74, 222, 128, 0.08)', borderRadius: 8, border: '1px solid rgba(74, 222, 128, 0.2)', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: '#4ade80', marginBottom: 4 }}>
                    <Zap size={14} /> Instância Evolution configurada
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>
                    Instância: <code style={{ fontSize: 11 }}>{globalInstance.instanceName}</code> — Status: {globalInstance.status}
                  </p>
                </div>
              ) : (
                <div style={{ padding: '10px 12px', background: 'rgba(251, 146, 60, 0.08)', borderRadius: 8, border: '1px solid rgba(251, 146, 60, 0.2)', marginBottom: 8 }}>
                  <p style={{ fontSize: 13, color: '#fb923c', fontWeight: 500, margin: '0 0 4px 0' }}>
                    Nenhuma instância configurada
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>
                    Vá em <a href="#/configuracao" style={{ color: 'var(--color-accent)' }}>Configuração</a> para criar sua instância WhatsApp primeiro.
                  </p>
                </div>
              )}
            </>
          )}

          <button type="submit" disabled={saving || (provider === 'EVOLUTION' && !globalInstance)} className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}>
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
  type: 'initial' | 'keyword' | 'menu' | 'option' | 'fallback' | 'iteration' | 'close';
  children: TreeNode[];
  gotoLabel?: string;
  entityId?: string;
  captureInfo?: string;
  iterationType?: string;
  order?: number;
}

function buildFlowTree(bot: Bot, keywords: Keyword[], menus: InteractiveMenu[], iterations?: BotIteration[]): TreeNode {
  const sortedIterations = [...(iterations || [])].filter(i => i.isActive !== false).sort((a, b) => a.order - b.order);

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
        entityId: menu.id,
        captureInfo: menu.captureVariable ? `${menu.captureVariable.name} (${menu.captureVariable.type})` : undefined,
        children: (menu.options || []).map((opt, i) => {
          const optNode: TreeNode = { id: `opt_${opt.id}_d${depth}_i${i}`, label: opt.title, type: 'option', children: [], gotoLabel: opt.goto ? `→ ${opt.goto.type.toLowerCase()}: ${opt.goto.target}` : undefined, entityId: menu.id };
          if (opt.goto) { const child = resolveGoto(opt.goto, depth + 1, nextPath); if (child) optNode.children.push(child); }
          return optNode;
        }),
      };
    }
    if (goto.type === 'KEYWORD') {
      const kw = keywords.find(k => k.trigger.toLowerCase() === goto.target.toLowerCase());
      if (!kw) return { id: `kw_missing_${goto.target}_d${depth}`, label: `Keyword: ${goto.target} (não encontrada)`, type: 'keyword', children: [] };
      const kwNode: TreeNode = {
        id: `kw_${kw.id}_d${depth}`, label: `Keyword: ${kw.trigger}`, type: 'keyword', children: [],
        gotoLabel: kw.goto ? `→ ${kw.goto.type.toLowerCase()}: ${kw.goto.target}` : undefined,
        entityId: kw.id,
        captureInfo: kw.captureVariable ? `${kw.captureVariable.name} (${kw.captureVariable.type})` : undefined,
      };
      if (kw.goto) { const child = resolveGoto(kw.goto, depth + 1, nextPath); if (child) kwNode.children.push(child); }
      return kwNode;
    }
    if (goto.type === 'ITERATION') {
      // Resolve to specific iteration if target is an ID
      const iter = sortedIterations.find(i => i.id === goto.target);
      if (iter) {
        const typeInfo = ITERATION_TYPES.find(t => t.value === iter.type);
        return {
          id: `iteration_${iter.id}_d${depth}`,
          label: `Iteração: ${iter.name}`,
          type: 'iteration',
          children: [],
          entityId: iter.id,
          iterationType: typeInfo?.label || iter.type,
          order: iter.order,
        };
      }
      // Fallback: show all iterations as children
      return {
        id: `iterations_all_d${depth}`,
        label: 'Iterações do bot',
        type: 'iteration',
        children: sortedIterations.map(i => {
          const typeInfo = ITERATION_TYPES.find(t => t.value === i.type);
          return {
            id: `iteration_${i.id}_d${depth}`,
            label: `${i.name}`,
            type: 'iteration' as const,
            children: [],
            entityId: i.id,
            iterationType: typeInfo?.label || i.type,
            order: i.order,
          };
        }),
      };
    }
    if (goto.type === 'LAST_INTERACTION') {
      const lastNode: TreeNode = { id: `last_interaction_d${depth}`, label: 'Última Interação (encerrar)', type: 'close', children: [] };
      if (bot.flowConfig?.lastInteraction) {
        const child = resolveGoto(bot.flowConfig.lastInteraction, depth + 1, nextPath);
        if (child) lastNode.children.push(child);
      }
      return lastNode;
    }
    return null;
  };

  const root: TreeNode = { id: 'root', label: bot.name, type: 'initial', children: [] };
  const flow = bot.flowConfig;

  if (flow?.initialInteraction) {
    const initNode = resolveGoto(flow.initialInteraction, 0, new Set());
    if (initNode) root.children.push(initNode);
  }

  // Show all iterations in the tree
  if (sortedIterations.length > 0) {
    for (const iter of sortedIterations) {
      const typeInfo = ITERATION_TYPES.find(t => t.value === iter.type);
      const iterNode: TreeNode = {
        id: `iter_${iter.id}`,
        label: `Iteração: ${iter.name}`,
        type: 'iteration',
        children: [],
        entityId: iter.id,
        iterationType: typeInfo?.label || iter.type,
        order: iter.order,
      };
      // If iteration has a GOTO content, resolve it
      if (iter.type === 'GOTO' && iter.content) {
        const c = iter.content as any;
        if (c.type && c.target) {
          const child = resolveGoto({ type: c.type, target: c.target }, 1, new Set());
          if (child) iterNode.children.push(child);
        }
      }
      root.children.push(iterNode);
    }
  }

  if (flow?.lastInteraction) {
    const lastNode: TreeNode = { id: 'last_interaction', label: 'Última Interação (encerrar)', type: 'close', children: [] };
    const child = resolveGoto(flow.lastInteraction, 0, new Set());
    if (child) lastNode.children.push(child);
    root.children.push(lastNode);
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
      const kwNode: TreeNode = {
        id: `standalone_kw_${kw.id}`, label: `Keyword: ${kw.trigger}`, type: 'keyword', children: [],
        gotoLabel: kw.goto ? `→ ${kw.goto.type.toLowerCase()}: ${kw.goto.target}` : undefined,
        entityId: kw.id,
        captureInfo: kw.captureVariable ? `${kw.captureVariable.name} (${kw.captureVariable.type})` : undefined,
      };
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

function TreeNodeView({
  node, depth = 0, onNodeClick, draggable, onDragStart, onDragOver, onDragEnd, onDrop, dragOverId,
}: {
  node: TreeNode;
  depth?: number;
  onNodeClick?: (node: TreeNode) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, node: TreeNode) => void;
  onDragOver?: (e: React.DragEvent, node: TreeNode) => void;
  onDragEnd?: () => void;
  onDrop?: (e: React.DragEvent, node: TreeNode) => void;
  dragOverId?: string | null;
}) {
  const icons: Record<TreeNode['type'], React.ReactNode> = {
    initial: <BotIcon size={12} />,
    keyword: <Key size={12} />,
    menu: <List size={12} />,
    option: <ChevronRight size={12} />,
    fallback: <ArrowRight size={12} />,
    iteration: <Repeat size={12} />,
    close: <PowerOff size={12} />,
  };

  const isClickable = onNodeClick && node.type !== 'initial';
  const isDraggable = draggable && node.type !== 'initial';
  const isDragOver = dragOverId === node.id;

  return (
    <div
      style={{ position: 'relative', marginLeft: depth > 0 ? 24 : 0 }}
      draggable={isDraggable}
      onDragStart={isDraggable ? (e) => onDragStart?.(e, node) : undefined}
      onDragOver={isDraggable ? (e) => { e.preventDefault(); onDragOver?.(e, node); } : undefined}
      onDragEnd={isDraggable ? () => onDragEnd?.() : undefined}
      onDrop={isDraggable ? (e) => { e.preventDefault(); onDrop?.(e, node); } : undefined}
    >
      {depth > 0 && <div className="flow-tree__connector-v" />}
      {depth > 0 && <div className="flow-tree__connector-h" />}

      <div className={`flow-tree__node${isDragOver ? ' flow-tree__node--drag-over' : ''}`}>
        {isDraggable && (
          <span className="flow-tree__drag-handle" title="Arraste para reordenar">
            <GripVertical size={14} />
          </span>
        )}
        <span
          className={`flow-tree__label flow-tree__label--${node.type}${isClickable ? ' flow-tree__label--clickable' : ''}`}
          onClick={isClickable ? () => onNodeClick(node) : undefined}
          title={isClickable ? 'Clique para editar' : undefined}
        >
          {icons[node.type]} {node.label}
        </span>
        {node.iterationType && (
          <span className="flow-tree__iteration-type-badge">{node.iterationType}</span>
        )}
        {node.order !== undefined && (
          <span className="flow-tree__order-badge">#{node.order}</span>
        )}
        {node.captureInfo && (
          <span className="flow-tree__capture-badge">
            <Zap size={9} /> {node.captureInfo}
          </span>
        )}
        {node.gotoLabel && (
          <span className="flow-tree__goto-badge">{node.gotoLabel}</span>
        )}
      </div>

      {node.children.length > 0 && (
        <div style={{ marginLeft: 16, position: 'relative' }}>
          <div style={{ position: 'absolute', left: -8, top: 0, bottom: 0, width: 1, background: 'var(--color-border)' }} />
          {node.children.map((child) => (
            <TreeNodeView
              key={child.id}
              node={child}
              depth={depth + 1}
              onNodeClick={onNodeClick}
              draggable={draggable}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
              onDrop={onDrop}
              dragOverId={dragOverId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FlowTreeModal({ open, onClose, bot, onEditKeyword, onEditMenu, onEditBot, onEditIteration }: {
  open: boolean; onClose: () => void; bot: Bot;
  onEditKeyword?: () => void; onEditMenu?: () => void; onEditBot?: () => void; onEditIteration?: () => void;
}) {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [menus, setMenus] = useState<InteractiveMenu[]>([]);
  const [iterations, setIterations] = useState<BotIteration[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [dragOverNodeId, setDragOverNodeId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([api.getKeywords(bot.id), api.getMenus(bot.id), api.getIterations(bot.id)])
      .then(([kws, mns, iters]) => { setKeywords(kws); setMenus(mns); setIterations(iters); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (open) load();
  }, [open, bot.id]);

  const tree = useMemo(() => {
    if (loading) return null;
    return buildFlowTree(bot, keywords, menus, iterations);
  }, [bot, keywords, menus, iterations, loading]);

  const handleNodeClick = (node: TreeNode) => {
    if (node.type === 'keyword') {
      onClose();
      onEditKeyword?.();
    } else if (node.type === 'menu' || node.type === 'option') {
      onClose();
      onEditMenu?.();
    } else if (node.type === 'fallback' || node.type === 'close') {
      onClose();
      onEditBot?.();
    } else if (node.type === 'iteration') {
      onClose();
      onEditIteration?.();
    }
  };

  // Extract iteration entity id from tree node id
  const getIterationId = (nodeId: string): string | null => {
    const match = nodeId.match(/^iter_(.+)$/);
    return match ? match[1] : null;
  };

  const handleDragStart = (_e: React.DragEvent, node: TreeNode) => {
    setDragNodeId(node.id);
  };

  const handleDragOver = (_e: React.DragEvent, node: TreeNode) => {
    if (node.id !== dragNodeId) {
      setDragOverNodeId(node.id);
    }
  };

  const handleDragEnd = () => {
    setDragNodeId(null);
    setDragOverNodeId(null);
  };

  const handleDrop = async (_e: React.DragEvent, targetNode: TreeNode) => {
    if (!dragNodeId || dragNodeId === targetNode.id || !tree) return;

    // Get root children (the flat list)
    const children = [...tree.children];
    const dragIdx = children.findIndex(c => c.id === dragNodeId);
    const dropIdx = children.findIndex(c => c.id === targetNode.id);

    if (dragIdx === -1 || dropIdx === -1) {
      handleDragEnd();
      return;
    }

    // Reorder
    const [moved] = children.splice(dragIdx, 1);
    children.splice(dropIdx, 0, moved);

    // Collect iteration nodes and update their order
    const iterationNodes = children.filter(c => c.id.startsWith('iter_'));
    const updates: Promise<void>[] = [];

    setReordering(true);
    for (let i = 0; i < iterationNodes.length; i++) {
      const iterId = getIterationId(iterationNodes[i].id);
      if (iterId) {
        const iter = iterations.find(it => it.id === iterId);
        if (iter && iter.order !== i) {
          updates.push(
            api.updateIteration(bot.id, iterId, { order: i }).catch(() => {})
          );
        }
      }
    }

    if (updates.length > 0) {
      await Promise.all(updates);
      toast.success('Ordem atualizada!');
      load();
    }

    setReordering(false);
    handleDragEnd();
  };

  return (
    <Modal open={open} onClose={onClose} title={`Árvore do Fluxo — ${bot.name}`} wide>
      {loading ? (
        <div className="loader" style={{ padding: '40px 0' }}>
          <Loader2 size={18} className="animate-spin" /> Carregando...
        </div>
      ) : tree && tree.children.length > 0 ? (
        <div>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 16 }}>
            <GripVertical size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> Arraste os itens para reordenar o fluxo.
            Clique em qualquer nó para editar.
            {' '}<span style={{ color: '#f59e0b' }}>Nós com captura</span> indicam variáveis que serão pedidas ao usuário.
          </p>
          {reordering && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 12, color: 'var(--color-accent)' }}>
              <Loader2 size={14} className="animate-spin" /> Atualizando ordem...
            </div>
          )}
          <div style={{ maxHeight: 520, overflowY: 'auto', overflowX: 'auto', paddingRight: 8 }}>
            <TreeNodeView
              node={tree}
              onNodeClick={handleNodeClick}
              draggable
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
              dragOverId={dragOverNodeId}
            />
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <GitBranch size={40} className="empty-state__icon" />
          <p className="empty-state__text">
            Nenhum fluxo configurado. Adicione keywords, menus, iterações e configure a primeira interação.
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
}

function WhatsAppEmulator({ open, onClose, bot }: { open: boolean; onClose: () => void; bot: Bot }) {
  const [messages, setMessages] = useState<EmulatorMessage[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [showContextPanel, setShowContextPanel] = useState(false);
  const [conversationStatus, setConversationStatus] = useState('BOT');
  const [variables, setVariables] = useState<Record<string, { name: string; type: string; value: string }>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionPhoneRef = useRef<string>(Date.now().toString());

  const resetConversation = async () => {
    try {
      await api.resetEmulatorConversation(bot.id, sessionPhoneRef.current);
    } catch { /* ignore */ }
    sessionPhoneRef.current = Date.now().toString();
    setMessages([]);
    setInput('');
    setVariables({});
    setConversationStatus('BOT');
  };

  useEffect(() => {
    if (open) {
      sessionPhoneRef.current = Date.now().toString();
      setMessages([]);
      setInput('');
      setVariables({});
      setConversationStatus('BOT');
    }
  }, [open, bot.id]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const now = () => { const d = new Date(); return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`; };

  const sendMessage = async (text?: string) => {
    const msgText = text || input.trim();
    if (!msgText || typing) return;
    if (!text) setInput('');

    // Adicionar mensagem do usuário
    const userMsg: EmulatorMessage = { id: Date.now().toString(), text: msgText, direction: 'outgoing', time: now(), status: 'sent' };
    setMessages((prev) => [...prev, userMsg]);
    setTimeout(() => setMessages((prev) => prev.map((m) => m.id === userMsg.id ? { ...m, status: 'delivered' as const } : m)), 500);
    setTimeout(() => setMessages((prev) => prev.map((m) => m.id === userMsg.id ? { ...m, status: 'read' as const } : m)), 1000);

    setTyping(true);

    try {
      // Chamar o backend — mesmo pipeline do WhatsApp real
      const response = await api.sendEmulatorMessage(bot.id, msgText, sessionPhoneRef.current);

      setTyping(false);

      // Adicionar as mensagens de resposta do bot
      for (const msg of response.messages) {
        const botMsg: EmulatorMessage = {
          id: (Date.now() + Math.random()).toString(),
          text: msg.content,
          direction: 'incoming',
          time: now(),
        };
        setMessages((prev) => [...prev, botMsg]);
      }

      // Atualizar estado da conversa
      setConversationStatus(response.status);
      setVariables(response.variables);
    } catch (err: any) {
      setTyping(false);
      const errorMsg: EmulatorMessage = {
        id: (Date.now() + Math.random()).toString(),
        text: `Erro no emulador: ${err?.response?.data?.message || err?.message || 'erro desconhecido'}`,
        direction: 'incoming',
        time: now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  };

  const varCount = Object.keys(variables).length;

  const copyVariablesAsJson = () => {
    navigator.clipboard.writeText(JSON.stringify(variables, null, 2));
    toast.success('Variáveis copiadas para a área de transferência');
  };

  if (!open) return null;

  return (
    <div className="wa-emulator" onClick={onClose}>
      <div className={`wa-emulator__phone${showContextPanel ? ' wa-emulator__phone--with-panel' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="wa-emulator__phone-main">
          <div className="wa-emulator__header">
            <button className="wa-emulator__back" onClick={onClose}><ArrowLeft size={20} /></button>
            <div className="wa-emulator__avatar"><BotIcon size={20} color="#fff" /></div>
            <div className="wa-emulator__contact">
              <p className="wa-emulator__contact-name">{bot.name}</p>
              <p className="wa-emulator__contact-status">{typing ? 'digitando...' : 'online'}</p>
            </div>
            <span className="wa-emulator__mode-badge">{bot.responseMode}</span>
            <button className="wa-emulator__header-btn" onClick={resetConversation} title="Resetar conversa">
              <RotateCcw size={16} />
            </button>
            <button className="wa-emulator__header-btn" onClick={() => setShowContextPanel(prev => !prev)} title="Painel de contexto">
              <Database size={16} />
              {varCount > 0 && <span className="wa-emulator__var-badge">{varCount}</span>}
            </button>
          </div>

          <div className="wa-emulator__chat whatsapp-chat-bg">
            {messages.length === 0 && (
              <div className="wa-emulator__empty">
                <div className="wa-emulator__empty-icon"><MessageSquare size={28} color="#8696a0" /></div>
                <p className="wa-emulator__empty-title">Emulador WhatsApp</p>
                <p className="wa-emulator__empty-text">
                  Envie uma mensagem para simular uma conversa com o bot <strong style={{ color: '#8696a0' }}>{bot.name}</strong>
                </p>
                <p className="wa-emulator__empty-text" style={{ fontSize: 11, marginTop: 4, color: '#53bdeb' }}>
                  Processamento real via backend — mesmo comportamento do WhatsApp
                </p>
                {bot.flowConfig?.initialInteraction && (
                  <div className="wa-emulator__empty-tag" style={{ marginTop: 12, fontSize: 11 }}>
                    Primeira interação: {bot.flowConfig.initialInteraction.type.toLowerCase()} → {bot.flowConfig.initialInteraction.target}
                  </div>
                )}
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`wa-emulator__message-row wa-emulator__message-row--${msg.direction === 'outgoing' ? 'out' : 'in'}`}>
                <div className={`wa-emulator__bubble ${msg.direction === 'outgoing' ? 'whatsapp-bubble-outgoing' : 'whatsapp-bubble-incoming'}`} style={{ color: '#e9edef' }}>
                  <span className="wa-emulator__bubble-text">{msg.text}</span>
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
              disabled={typing}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || typing}
              className="wa-emulator__send"
            >
              <Send size={16} color="#fff" />
            </button>
          </div>
        </div>

        {/* ─── Painel de Contexto ─── */}
        {showContextPanel && (
          <div className="wa-emulator__context-panel">
            <div className="wa-emulator__context-header">
              <h3 className="wa-emulator__context-title">Contexto da Conversa</h3>
              {varCount > 0 && (
                <button className="wa-emulator__context-copy" onClick={copyVariablesAsJson} title="Copiar JSON">
                  <Copy size={14} />
                </button>
              )}
            </div>

            {/* Estado da conversa */}
            <div className="wa-emulator__context-section">
              <h4 className="wa-emulator__context-section-title">Estado</h4>
              <div className="wa-emulator__context-info">
                <div className="wa-emulator__context-row">
                  <span className="wa-emulator__context-label">Status</span>
                  <span className="wa-emulator__context-value" style={conversationStatus === 'CLOSED' ? { color: '#f87171' } : undefined}>
                    {conversationStatus}
                  </span>
                </div>
                <div className="wa-emulator__context-row">
                  <span className="wa-emulator__context-label">Modo</span>
                  <span className="wa-emulator__context-value">{bot.responseMode}</span>
                </div>
                <div className="wa-emulator__context-row">
                  <span className="wa-emulator__context-label">Mensagens</span>
                  <span className="wa-emulator__context-value">{messages.length}</span>
                </div>
              </div>
            </div>

            {/* Variáveis capturadas */}
            <div className="wa-emulator__context-section">
              <h4 className="wa-emulator__context-section-title">
                Variáveis Capturadas
                {varCount > 0 && <span className="wa-emulator__context-count">{varCount}</span>}
              </h4>
              {varCount === 0 ? (
                <p className="wa-emulator__context-empty">Nenhuma variável capturada ainda.</p>
              ) : (
                <div className="wa-emulator__context-vars">
                  {Object.entries(variables).map(([name, v]) => (
                    <div key={name} className="wa-emulator__context-var">
                      <div className="wa-emulator__context-var-header">
                        <span className="wa-emulator__context-var-name">{name}</span>
                        <span className="wa-emulator__context-var-type">{v.type}</span>
                      </div>
                      <span className="wa-emulator__context-var-value">{v.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Flow Preview (compact) ───
function buildFlowPreview(bot: Bot): string[] {
  const preview: string[] = [];
  const flow = bot.flowConfig;
  if (flow?.initialInteraction) {
    const label = flow.initialInteraction.type === 'ITERATION'
      ? `iteração: ${flow.initialInteraction.target || 'todas'}`
      : `${flow.initialInteraction.type.toLowerCase()}: ${flow.initialInteraction.target}`;
    preview.push(`inicio → ${label}`);
  }
  else if (bot.initialMessage?.trim()) preview.push(`inicio: ${bot.initialMessage.trim()}`);
  const steps = flow?.steps || [];
  for (const step of steps) {
    if (step.type === 'GOTO_MENU' && step.menuTrigger) preview.push(`goto menu: ${step.menuTrigger}`);
    if (step.type === 'GOTO_KEYWORD' && step.keywordTrigger) preview.push(`goto keyword: ${step.keywordTrigger}`);
  }
  if (flow?.lastInteraction) {
    const label = flow.lastInteraction.type === 'ITERATION' ? 'iterações' : `${flow.lastInteraction.type.toLowerCase()}: ${flow.lastInteraction.target}`;
    preview.push(`última → ${label} (encerrar)`);
  }
  if (flow?.fallback?.goto) preview.push(`fallback → ${flow.fallback.goto.type.toLowerCase()}: ${flow.fallback.goto.target}`);
  return preview;
}

// ─── Iterations Modal ───
const ITERATION_TYPES = [
  { value: 'TEXT', label: 'Texto', icon: FileText, color: '#4ade80' },
  { value: 'LINK', label: 'Link', icon: LinkIcon, color: '#60a5fa' },
  { value: 'DOCUMENT', label: 'Documento', icon: File, color: '#f59e0b' },
  { value: 'GOTO', label: 'Goto', icon: ArrowRight, color: '#c084fc' },
  { value: 'CAPTURE_VARIABLE', label: 'Capturar Variável', icon: Variable, color: '#f472b6' },
  { value: 'CLOSE_CONVERSATION', label: 'Encerramento', icon: PowerOff, color: '#f87171' },
  { value: 'AI', label: 'I.A.', icon: Sparkles, color: '#a78bfa' },
] as const;

function IterationsModal({ open, onClose, bot }: { open: boolean; onClose: () => void; bot: Bot }) {
  const [iterations, setIterations] = useState<BotIteration[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [menus, setMenus] = useState<InteractiveMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<BotIteration['type']>('TEXT');
  const [formOrder, setFormOrder] = useState(0);

  // TEXT content
  const [textMessage, setTextMessage] = useState('');

  // LINK content
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');

  // DOCUMENT content
  const [docUrl, setDocUrl] = useState('');
  const [docFilename, setDocFilename] = useState('');
  const [docCaption, setDocCaption] = useState('');
  const [docMediaType, setDocMediaType] = useState<'image' | 'document' | 'video' | 'audio'>('document');

  // GOTO content
  const [gotoType, setGotoType] = useState<GotoTarget['type'] | ''>('');
  const [gotoTarget, setGotoTarget] = useState('');

  // CAPTURE_VARIABLE content
  const [capName, setCapName] = useState('');
  const [capType, setCapType] = useState<CaptureVariable['type']>('STRING');
  const [capPrompt, setCapPrompt] = useState('');
  const [capGotoType, setCapGotoType] = useState<GotoTarget['type'] | ''>('');
  const [capGotoTarget, setCapGotoTarget] = useState('');

  // CLOSE_CONVERSATION content
  const [closeMessage, setCloseMessage] = useState('Atendimento encerrado. Obrigado pelo contato!');

  // AI content
  const [aiPrompt, setAiPrompt] = useState('');

  const resetForm = () => {
    setFormName('');
    setFormType('TEXT');
    setFormOrder(0);
    setTextMessage('');
    setLinkUrl('');
    setLinkTitle('');
    setDocUrl('');
    setDocFilename('');
    setDocCaption('');
    setDocMediaType('document');
    setGotoType('');
    setGotoTarget('');
    setCapName('');
    setCapType('STRING');
    setCapPrompt('');
    setCapGotoType('');
    setCapGotoTarget('');
    setCloseMessage('Atendimento encerrado. Obrigado pelo contato!');
    setAiPrompt('');
    setEditingId(null);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [iters, kws, mns] = await Promise.all([
        api.getIterations(bot.id),
        api.getKeywords(bot.id),
        api.getMenus(bot.id),
      ]);
      setIterations(iters);
      setKeywords(kws);
      setMenus(mns);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { if (open) load(); }, [open]);

  const botVariables = useMemo(() => collectBotVariables(iterations, keywords, menus), [iterations, keywords, menus]);

  const buildContent = (): Record<string, any> => {
    switch (formType) {
      case 'TEXT':
        return { message: textMessage };
      case 'LINK':
        return { url: linkUrl, title: linkTitle || undefined };
      case 'DOCUMENT':
        return { url: docUrl, filename: docFilename || undefined, caption: docCaption || undefined, mediaType: docMediaType };
      case 'GOTO':
        return { type: gotoType, target: gotoTarget };
      case 'CAPTURE_VARIABLE':
        return {
          name: capName,
          variableType: capType,
          promptMessage: capPrompt,
          goto: capGotoType && capGotoTarget ? { type: capGotoType, target: capGotoTarget } : undefined,
        };
      case 'CLOSE_CONVERSATION':
        return { message: closeMessage };
      case 'AI':
        return { prompt: aiPrompt };
      default:
        return {};
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) { toast.error('Nome é obrigatório'); return; }

    const payload = {
      name: formName.trim(),
      type: formType,
      content: buildContent(),
      order: formOrder,
    };

    try {
      if (editingId) {
        await api.updateIteration(bot.id, editingId, payload);
        toast.success('Iteração atualizada!');
      } else {
        await api.createIteration(bot.id, payload);
        toast.success('Iteração criada!');
      }
      resetForm();
      setShowAdd(false);
      load();
    } catch (err) {
      toast.error(`Erro ao salvar iteração: ${extractApiError(err)}`);
    }
  };

  const onDelete = async (id: string) => {
    try {
      await api.deleteIteration(bot.id, id);
      toast.success('Iteração removida!');
      load();
    } catch (err) {
      toast.error(`Erro ao remover iteração: ${extractApiError(err)}`);
    }
  };

  const onEdit = (iter: BotIteration) => {
    setShowAdd(true);
    setEditingId(iter.id);
    setFormName(iter.name);
    setFormType(iter.type);
    setFormOrder(iter.order);

    const c = iter.content as any;
    switch (iter.type) {
      case 'TEXT':
        setTextMessage(c.message || '');
        break;
      case 'LINK':
        setLinkUrl(c.url || '');
        setLinkTitle(c.title || '');
        break;
      case 'DOCUMENT':
        setDocUrl(c.url || '');
        setDocFilename(c.filename || '');
        setDocCaption(c.caption || '');
        setDocMediaType(c.mediaType || 'document');
        break;
      case 'GOTO':
        setGotoType(c.type || '');
        setGotoTarget(c.target || '');
        break;
      case 'CAPTURE_VARIABLE':
        setCapName(c.name || '');
        setCapType(c.variableType || 'STRING');
        setCapPrompt(c.promptMessage || '');
        setCapGotoType(c.goto?.type || '');
        setCapGotoTarget(c.goto?.target || '');
        break;
      case 'CLOSE_CONVERSATION':
        setCloseMessage(c.message || 'Atendimento encerrado. Obrigado pelo contato!');
        break;
      case 'AI':
        setAiPrompt(c.prompt || '');
        break;
    }
  };

  const getTypeInfo = (type: string) => ITERATION_TYPES.find(t => t.value === type) || ITERATION_TYPES[0];

  const getContentPreview = (iter: BotIteration) => {
    const c = iter.content as any;
    switch (iter.type) {
      case 'TEXT': return c.message?.substring(0, 60) + (c.message?.length > 60 ? '...' : '') || '';
      case 'LINK': return c.url || '';
      case 'DOCUMENT': return `${c.mediaType || 'document'}: ${c.filename || c.url || ''}`;
      case 'GOTO': return `${(c.type || '').toLowerCase()}: ${c.target || ''}`;
      case 'CAPTURE_VARIABLE': return `${c.name} (${c.variableType || 'STRING'})`;
      case 'CLOSE_CONVERSATION': return c.message?.substring(0, 60) || 'Encerrar conversa';
      case 'AI': return c.prompt?.substring(0, 60) + (c.prompt?.length > 60 ? '...' : '') || 'Prompt I.A.';
      default: return '';
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Iterações — ${bot.name}`} wide>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 18 }}>
        Configure as interações do bot: textos, links, documentos, navegação (goto), captura de variáveis e I.A.
      </p>

      {showAdd ? (
        <form onSubmit={onSubmit}>
          <div className="form-row">
            <FormField label="Nome da iteração">
              <input className="form-input" placeholder="Ex: Boas-vindas, Enviar catálogo" value={formName} onChange={e => setFormName(e.target.value)} />
            </FormField>
            <FormField label="Tipo">
              <select className="form-input" value={formType} onChange={e => { setFormType(e.target.value as BotIteration['type']); }}>
                {ITERATION_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Ordem">
              <input className="form-input" type="number" value={formOrder} onChange={e => setFormOrder(Number(e.target.value))} style={{ width: 80 }} />
            </FormField>
          </div>

          {/* TEXT fields */}
          {formType === 'TEXT' && (
            <FormField label="Mensagem">
              <VariableInput
                value={textMessage}
                onChange={setTextMessage}
                variables={botVariables}
                multiline
                rows={3}
                placeholder="Texto que o bot enviará. Digite /var para inserir variáveis."
                className="form-input"
              />
            </FormField>
          )}

          {/* LINK fields */}
          {formType === 'LINK' && (
            <>
              <FormField label="URL do link">
                <input className="form-input" placeholder="https://exemplo.com" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} />
              </FormField>
              <FormField label="Título (opcional)">
                <input className="form-input" placeholder="Confira nosso site" value={linkTitle} onChange={e => setLinkTitle(e.target.value)} />
              </FormField>
            </>
          )}

          {/* DOCUMENT fields */}
          {formType === 'DOCUMENT' && (
            <>
              <div className="form-row">
                <FormField label="URL do arquivo">
                  <input className="form-input" placeholder="https://exemplo.com/arquivo.pdf" value={docUrl} onChange={e => setDocUrl(e.target.value)} />
                </FormField>
                <FormField label="Tipo de mídia">
                  <select className="form-input" value={docMediaType} onChange={e => setDocMediaType(e.target.value as any)}>
                    <option value="document">Documento (PDF, etc)</option>
                    <option value="image">Imagem</option>
                    <option value="video">Vídeo</option>
                    <option value="audio">Áudio</option>
                  </select>
                </FormField>
              </div>
              <div className="form-row">
                <FormField label="Nome do arquivo (opcional)">
                  <input className="form-input" placeholder="catalogo.pdf" value={docFilename} onChange={e => setDocFilename(e.target.value)} />
                </FormField>
                <FormField label="Legenda (opcional)">
                  <input className="form-input" placeholder="Segue nosso catálogo" value={docCaption} onChange={e => setDocCaption(e.target.value)} />
                </FormField>
              </div>
            </>
          )}

          {/* GOTO fields */}
          {formType === 'GOTO' && (
            <GotoSelector
              gotoType={gotoType}
              gotoTarget={gotoTarget}
              onTypeChange={setGotoType}
              onTargetChange={setGotoTarget}
              keywords={keywords}
              menus={menus}
              iterations={iterations}
              label="Destino do goto"
              showIteration
              showLastInteraction
            />
          )}

          {/* CAPTURE_VARIABLE fields */}
          {formType === 'CAPTURE_VARIABLE' && (
            <>
              <div className="form-row">
                <FormField label="Nome da variável">
                  <input className="form-input" placeholder="Ex: cpf, email, nome" value={capName} onChange={e => setCapName(e.target.value)} />
                </FormField>
                <FormField label="Tipo da variável">
                  <select className="form-input" value={capType} onChange={e => setCapType(e.target.value as CaptureVariable['type'])}>
                    <option value="STRING">Texto (STRING)</option>
                    <option value="NUMBER">Número (NUMBER)</option>
                    <option value="BOOLEAN">Sim/Não (BOOLEAN)</option>
                    <option value="DATE">Data (DATE)</option>
                  </select>
                </FormField>
              </div>
              <FormField label="Mensagem de prompt">
                <input className="form-input" placeholder="Ex: Por favor, digite seu CPF" value={capPrompt} onChange={e => setCapPrompt(e.target.value)} />
              </FormField>
              <GotoSelector
                gotoType={capGotoType}
                gotoTarget={capGotoTarget}
                onTypeChange={setCapGotoType}
                onTargetChange={setCapGotoTarget}
                keywords={keywords}
                menus={menus}
                iterations={iterations}
                label="Goto após captura (opcional)"
                showIteration
                showLastInteraction
              />
            </>
          )}

          {/* CLOSE_CONVERSATION fields */}
          {formType === 'CLOSE_CONVERSATION' && (
            <FormField label="Mensagem de encerramento">
              <VariableInput
                value={closeMessage}
                onChange={setCloseMessage}
                variables={botVariables}
                multiline
                rows={3}
                placeholder="Mensagem enviada ao encerrar a conversa. Digite /var para variáveis."
                className="form-input"
              />
            </FormField>
          )}

          {/* AI fields */}
          {formType === 'AI' && (
            <FormField label="Prompt da I.A.">
              <VariableInput
                value={aiPrompt}
                onChange={setAiPrompt}
                variables={botVariables}
                multiline
                rows={5}
                placeholder="Instruções para a I.A. seguir neste ponto do fluxo. Ex: 'Você é um assistente de vendas. Apresente os produtos disponíveis e ajude o cliente a escolher.' Digite /var para inserir variáveis."
                className="form-input"
              />
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                A I.A. seguirá exatamente este prompt quando o fluxo chegar nesta iteração. Funciona apenas nos modos I.A. ou Híbrido.
              </p>
            </FormField>
          )}

          <div className="modal__footer" style={{ marginTop: 16 }}>
            <button type="button" className="btn btn-secondary" onClick={() => { resetForm(); setShowAdd(false); }}>Cancelar</button>
            <button type="submit" className="btn btn-primary">
              {editingId ? 'Salvar' : 'Adicionar'} Iteração
            </button>
          </div>
        </form>
      ) : (
        <button className="btn btn-primary" style={{ marginBottom: 16 }} onClick={() => { resetForm(); setShowAdd(true); }}>
          <Plus size={15} /> Nova Iteração
        </button>
      )}

      <div className="keywords-list">
        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Carregando...</p>
        ) : iterations.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', padding: '24px 0' }}>Nenhuma iteração cadastrada.</p>
        ) : iterations.map(iter => {
          const typeInfo = getTypeInfo(iter.type);
          const TypeIcon = typeInfo.icon;
          return (
            <div key={iter.id} className="keyword-row">
              <div className="keyword-row__content">
                <div className="keyword-row__trigger-line">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <TypeIcon size={14} color={typeInfo.color} />
                    <span className="keyword-row__trigger">{iter.name}</span>
                  </span>
                  <span className="badge badge-accent" style={{ fontSize: 10, marginLeft: 8 }}>{typeInfo.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 8 }}>ordem: {iter.order}</span>
                </div>
                <div className="keyword-row__goto" style={{ color: typeInfo.color }}>
                  {getContentPreview(iter)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-icon" title="Editar" onClick={() => onEdit(iter)}>
                  <Pencil size={14} />
                </button>
                <button className="keyword-row__delete" onClick={() => onDelete(iter.id)}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

// ─── Main Page ───
// ─── Knowledge Modal (Conhecimento IA) ───
function KnowledgeModal({ open, onClose, bot }: { open: boolean; onClose: () => void; bot: Bot }) {
  const [docs, setDocs] = useState<BotKnowledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocs = async () => {
    setLoading(true);
    try {
      const data = await api.getKnowledge(bot.id);
      setDocs(data);
    } catch (err) {
      toast.error(`Erro ao carregar conhecimento: ${extractApiError(err)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadDocs();
  }, [open, bot.id]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['.pdf', '.txt', '.csv', '.xlsx', '.xls'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedTypes.includes(ext)) {
      toast.error(`Tipo de arquivo não suportado. Use: ${allowedTypes.join(', ')}`);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande. O tamanho máximo é 10MB.');
      return;
    }

    setUploading(true);
    try {
      await api.uploadKnowledge(bot.id, file);
      toast.success(`"${file.name}" processado com sucesso!`);
      await loadDocs();
    } catch (err) {
      toast.error(`Erro ao enviar arquivo: ${extractApiError(err)}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (doc: BotKnowledge) => {
    try {
      await api.deleteKnowledge(bot.id, doc.id);
      toast.success(`"${doc.fileName}" removido!`);
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err) {
      toast.error(`Erro ao remover: ${extractApiError(err)}`);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const fileTypeIcon = (type: string) => {
    switch (type) {
      case 'pdf': return '📄';
      case 'txt': return '📝';
      case 'csv': return '📊';
      case 'xlsx': case 'xls': return '📗';
      default: return '📁';
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Conhecimento IA — ${bot.name}`} wide>
      <div style={{ marginBottom: 16 }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 12 }}>
          Faça upload de documentos para que a I.A. aprenda e use como base de conhecimento nas respostas.
          Formatos aceitos: PDF, TXT, CSV, Excel. Máximo 10MB por arquivo.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.csv,.xlsx,.xls"
          onChange={handleUpload}
          style={{ display: 'none' }}
        />

        <button
          className="btn btn-primary"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {uploading ? <Loader2 size={15} className="spin" /> : <Upload size={15} />}
          {uploading ? 'Processando...' : 'Enviar Documento'}
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)' }}>
          <Loader2 size={20} className="spin" /> Carregando...
        </div>
      ) : docs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)' }}>
          <BookOpen size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
          <p>Nenhum documento de conhecimento cadastrado.</p>
          <p style={{ fontSize: 12 }}>Envie documentos para que a I.A. possa usar como referência.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {docs.map((doc) => (
            <div
              key={doc.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: 'var(--color-bg-elevated, #1a1a2e)',
                borderRadius: 8,
                border: '1px solid var(--color-border, #2a2a4a)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 20 }}>{fileTypeIcon(doc.fileType)}</span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 500, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {doc.fileName}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {formatSize(doc.fileSize)} &middot; {doc.totalChunks} chunks &middot; {new Date(doc.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
              <button
                className="btn btn-icon"
                title="Remover"
                onClick={() => handleDelete(doc)}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = ''; }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export default function BotsPage() {
  const { bots, fetchBots, deleteBot, updateBot, loading } = useBotStore();
  const [showForm, setShowForm] = useState(false);
  const [editBot, setEditBot] = useState<Bot | null>(null);
  const [kwBot, setKwBot] = useState<Bot | null>(null);
  const [menuBot, setMenuBot] = useState<Bot | null>(null);
  const [waBot, setWaBot] = useState<Bot | null>(null);
  const [emulatorBot, setEmulatorBot] = useState<Bot | null>(null);
  const [treeBot, setTreeBot] = useState<Bot | null>(null);
  const [iterBot, setIterBot] = useState<Bot | null>(null);
  const [knowledgeBot, setKnowledgeBot] = useState<Bot | null>(null);

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
                  <button className="btn btn-icon" title="Iterações" onClick={() => setIterBot(bot)}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f59e0b'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = ''; }}
                  ><Repeat size={15} /></button>
                  <button className="btn btn-icon" title="Conhecimento IA" onClick={() => setKnowledgeBot(bot)}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#a78bfa'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = ''; }}
                  ><BookOpen size={15} /></button>
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
      {iterBot && <IterationsModal open={!!iterBot} onClose={() => setIterBot(null)} bot={iterBot} />}
      {knowledgeBot && <KnowledgeModal open={!!knowledgeBot} onClose={() => setKnowledgeBot(null)} bot={knowledgeBot} />}
      {waBot && <WhatsAppModal open={!!waBot} onClose={() => setWaBot(null)} bot={waBot} />}
      {emulatorBot && <WhatsAppEmulator open={!!emulatorBot} onClose={() => setEmulatorBot(null)} bot={emulatorBot} />}
      {treeBot && (
        <FlowTreeModal
          open={!!treeBot}
          onClose={() => setTreeBot(null)}
          bot={treeBot}
          onEditKeyword={() => setKwBot(treeBot)}
          onEditMenu={() => setMenuBot(treeBot)}
          onEditBot={() => { setEditBot(treeBot); setShowForm(true); }}
          onEditIteration={() => setIterBot(treeBot)}
        />
      )}
    </div>
  );
}
