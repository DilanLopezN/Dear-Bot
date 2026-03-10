import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/services/api';
import {
  Plus, Trash2, Pencil, X, Loader2, Star, Cpu, Check,
} from 'lucide-react';

const inputClass = "w-full px-4 py-3 rounded-xl bg-[var(--color-bg-input)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-all";
const btnPrimary = "px-6 py-3 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-medium transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50";
const btnDanger = "px-5 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm transition-all cursor-pointer flex items-center gap-2";
const btnSecondary = "px-5 py-3 rounded-xl text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-all cursor-pointer";

type AiProvider = 'CLAUDE' | 'OPENAI' | 'GEMINI';

interface AiConfig {
  id: string;
  provider: AiProvider;
  name: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  isDefault: boolean;
  createdAt: string;
  _count?: { bots: number };
}

interface ConfigForm {
  provider: AiProvider;
  name: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  isDefault: boolean;
}

const providerInfo: Record<AiProvider, { label: string; color: string; models: { value: string; label: string }[] }> = {
  CLAUDE: {
    label: 'Claude (Anthropic)',
    color: 'text-orange-400',
    models: [
      { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
      { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
      { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
    ],
  },
  OPENAI: {
    label: 'OpenAI',
    color: 'text-green-400',
    models: [
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    ],
  },
  GEMINI: {
    label: 'Gemini (Google)',
    color: 'text-blue-400',
    models: [
      { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
      { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
      { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
      { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    ],
  },
};

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-7 py-5 border-b border-[var(--color-border)]">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>{title}</h2>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer p-1"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-7">{children}</div>
      </div>
    </div>
  );
}

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <label className="text-sm font-medium text-[var(--color-text-secondary)] mb-2 block">{label}</label>
      {children}
      {error && <span className="text-xs text-red-400 mt-1.5 block">{error}</span>}
    </div>
  );
}

function ConfigFormModal({ open, onClose, config, onSaved }: { open: boolean; onClose: () => void; config?: AiConfig | null; onSaved: () => void }) {
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<ConfigForm>({
    defaultValues: {
      provider: config?.provider || 'CLAUDE',
      name: config?.name || '',
      apiKey: config?.apiKey || '',
      model: config?.model || '',
      maxTokens: config?.maxTokens || 1024,
      temperature: config?.temperature || 0.7,
      isDefault: config?.isDefault || false,
    },
  });
  const [saving, setSaving] = useState(false);
  const selectedProvider = watch('provider');

  useEffect(() => {
    if (config) {
      reset({
        provider: config.provider,
        name: config.name,
        apiKey: config.apiKey,
        model: config.model,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
        isDefault: config.isDefault,
      });
    } else {
      reset({
        provider: 'CLAUDE',
        name: '',
        apiKey: '',
        model: '',
        maxTokens: 1024,
        temperature: 0.7,
        isDefault: false,
      });
    }
  }, [config, reset]);

  // Update default model when provider changes (only on create)
  useEffect(() => {
    if (!config) {
      const models = providerInfo[selectedProvider]?.models;
      if (models?.length) {
        setValue('model', models[0].value);
      }
    }
  }, [selectedProvider, config, setValue]);

  const onSubmit = async (data: ConfigForm) => {
    setSaving(true);
    try {
      if (config) {
        await api.updateAiConfig(config.id, data as unknown as Record<string, unknown>);
      } else {
        await api.createAiConfig(data);
      }
      onSaved();
      onClose();
    } catch {} finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={config ? 'Editar Configuração de I.A.' : 'Nova Configuração de I.A.'}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FormField label="Provedor" error={errors.provider?.message}>
          <select {...register('provider', { required: 'Obrigatório' })} className={inputClass} disabled={!!config}>
            <option value="CLAUDE">Claude (Anthropic)</option>
            <option value="OPENAI">OpenAI</option>
            <option value="GEMINI">Gemini (Google)</option>
          </select>
        </FormField>

        <FormField label="Nome" error={errors.name?.message}>
          <input {...register('name', { required: 'Nome obrigatório' })} placeholder="Ex: Meu GPT-4o" className={inputClass} />
        </FormField>

        <FormField label="API Key" error={errors.apiKey?.message}>
          <input {...register('apiKey', { required: 'API Key obrigatória' })} placeholder="sk-..." type="password" className={inputClass} />
        </FormField>

        <FormField label="Modelo" error={errors.model?.message}>
          <select {...register('model', { required: 'Modelo obrigatório' })} className={inputClass}>
            {providerInfo[selectedProvider]?.models.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Ou digite manualmente o ID do modelo</p>
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Max Tokens" error={errors.maxTokens?.message}>
            <input {...register('maxTokens', { required: true, valueAsNumber: true, min: 1, max: 128000 })} type="number" className={inputClass} />
          </FormField>
          <FormField label="Temperatura" error={errors.temperature?.message}>
            <input {...register('temperature', { required: true, valueAsNumber: true, min: 0, max: 2 })} type="number" step="0.1" className={inputClass} />
          </FormField>
        </div>

        <div className="flex items-center gap-3 mb-5">
          <input {...register('isDefault')} type="checkbox" id="isDefault" className="w-4 h-4 rounded border-[var(--color-border)] accent-[var(--color-accent)]" />
          <label htmlFor="isDefault" className="text-sm text-[var(--color-text-secondary)]">
            Definir como padrão para este provedor
          </label>
        </div>

        <div className="flex justify-end gap-3 mt-7">
          <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {config ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function AiConfigPage() {
  const [configs, setConfigs] = useState<AiConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editConfig, setEditConfig] = useState<AiConfig | null>(null);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      setConfigs(await api.getAiConfigs());
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadConfigs(); }, []);

  const handleDelete = async (id: string) => {
    try {
      await api.deleteAiConfig(id);
      loadConfigs();
    } catch {}
  };

  const grouped: Record<AiProvider, AiConfig[]> = { CLAUDE: [], OPENAI: [], GEMINI: [] };
  configs.forEach((c) => {
    if (grouped[c.provider]) grouped[c.provider].push(c);
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>
            Configurações de I.A.
          </h1>
          <p className="text-base text-[var(--color-text-secondary)] mt-2">
            Gerencie seus provedores de inteligência artificial
          </p>
        </div>
        <button onClick={() => { setEditConfig(null); setShowForm(true); }} className={btnPrimary}>
          <Plus className="w-4 h-4" /> Nova Configuração
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-[var(--color-text-muted)]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
        </div>
      ) : configs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-60 text-center">
          <Cpu className="w-14 h-14 text-[var(--color-text-muted)] mb-4" />
          <p className="text-[var(--color-text-secondary)] text-base">Nenhuma configuração de I.A.</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-2">
            Adicione uma configuração de Claude, OpenAI ou Gemini para usar I.A. nos seus bots
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {(Object.entries(grouped) as [AiProvider, AiConfig[]][]).map(([provider, items]) => {
            if (items.length === 0) return null;
            const info = providerInfo[provider];
            return (
              <div key={provider}>
                <h2 className={`text-lg font-semibold mb-4 ${info.color}`} style={{ fontFamily: 'var(--font-display)' }}>
                  {info.label}
                </h2>
                <div className="grid grid-cols-1 gap-4">
                  {items.map((config) => (
                    <div key={config.id} className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-6 hover:border-[var(--color-border-light)] transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            provider === 'CLAUDE' ? 'bg-orange-500/10' :
                            provider === 'OPENAI' ? 'bg-green-500/10' : 'bg-blue-500/10'
                          }`}>
                            <Cpu className={`w-5 h-5 ${info.color}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{config.name}</h3>
                              {config.isDefault && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 flex items-center gap-1">
                                  <Star className="w-3 h-3" /> Padrão
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
                              Modelo: <span className="text-[var(--color-text-secondary)]">{config.model}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setEditConfig(config); setShowForm(true); }}
                            className="p-2.5 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-all cursor-pointer"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(config.id)}
                            className="p-2.5 rounded-lg hover:bg-red-500/10 text-[var(--color-text-muted)] hover:text-red-400 transition-all cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-5 mt-4 text-xs text-[var(--color-text-muted)]">
                        <span>Max Tokens: <strong className="text-[var(--color-text-secondary)]">{config.maxTokens.toLocaleString()}</strong></span>
                        <span>Temperatura: <strong className="text-[var(--color-text-secondary)]">{config.temperature}</strong></span>
                        <span>API Key: <strong className="text-[var(--color-text-secondary)]">{"•".repeat(8)}{config.apiKey.slice(-4)}</strong></span>
                        {config._count && (
                          <span className="flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> {config._count.bots} bot{config._count.bots !== 1 ? 's' : ''} vinculado{config._count.bots !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfigFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditConfig(null); }}
        config={editConfig}
        onSaved={loadConfigs}
      />
    </div>
  );
}
