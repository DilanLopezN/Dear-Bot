import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/services/api';
import { Plus, Trash2, Pencil, X, Loader2, Star, Cpu, Check } from 'lucide-react';
import './AiConfigPage.css';

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

const providerInfo: Record<AiProvider, { label: string; colorClass: string; iconClass: string; models: { value: string; label: string }[] }> = {
  CLAUDE: {
    label: 'Claude (Anthropic)',
    colorClass: 'ai-config__provider-heading--claude',
    iconClass: 'ai-config__provider-icon--claude',
    models: [
      { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
      { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
      { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
    ],
  },
  OPENAI: {
    label: 'OpenAI',
    colorClass: 'ai-config__provider-heading--openai',
    iconClass: 'ai-config__provider-icon--openai',
    models: [
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    ],
  },
  GEMINI: {
    label: 'Gemini (Google)',
    colorClass: 'ai-config__provider-heading--gemini',
    iconClass: 'ai-config__provider-icon--gemini',
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">{title}</h2>
          <button className="modal__close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="form-field">
      <label className="form-label">{label}</label>
      {children}
      {error && <span className="form-error">{error}</span>}
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
      reset({ provider: config.provider, name: config.name, apiKey: config.apiKey, model: config.model, maxTokens: config.maxTokens, temperature: config.temperature, isDefault: config.isDefault });
    } else {
      reset({ provider: 'CLAUDE', name: '', apiKey: '', model: '', maxTokens: 1024, temperature: 0.7, isDefault: false });
    }
  }, [config, reset]);

  useEffect(() => {
    if (!config) {
      const models = providerInfo[selectedProvider]?.models;
      if (models?.length) setValue('model', models[0].value);
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
    } catch {} finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={config ? 'Editar Configuração de I.A.' : 'Nova Configuração de I.A.'}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FormField label="Provedor" error={errors.provider?.message}>
          <select {...register('provider', { required: 'Obrigatório' })} className="form-input" disabled={!!config}>
            <option value="CLAUDE">Claude (Anthropic)</option>
            <option value="OPENAI">OpenAI</option>
            <option value="GEMINI">Gemini (Google)</option>
          </select>
        </FormField>

        <FormField label="Nome" error={errors.name?.message}>
          <input {...register('name', { required: 'Nome obrigatório' })} placeholder="Ex: Meu GPT-4o" className="form-input" />
        </FormField>

        <FormField label="API Key" error={errors.apiKey?.message}>
          <input {...register('apiKey', { required: 'API Key obrigatória' })} placeholder="sk-..." type="password" className="form-input" />
        </FormField>

        <FormField label="Modelo" error={errors.model?.message}>
          <select {...register('model', { required: 'Modelo obrigatório' })} className="form-input">
            {providerInfo[selectedProvider]?.models.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <span className="form-hint">Ou digite manualmente o ID do modelo</span>
        </FormField>

        <div className="form-row">
          <FormField label="Max Tokens" error={errors.maxTokens?.message}>
            <input {...register('maxTokens', { required: true, valueAsNumber: true, min: 1, max: 128000 })} type="number" className="form-input" />
          </FormField>
          <FormField label="Temperatura" error={errors.temperature?.message}>
            <input {...register('temperature', { required: true, valueAsNumber: true, min: 0, max: 2 })} type="number" step="0.1" className="form-input" />
          </FormField>
        </div>

        <div className="ai-config__checkbox-row">
          <input {...register('isDefault')} type="checkbox" id="isDefault" />
          <label htmlFor="isDefault" className="ai-config__checkbox-label">
            Definir como padrão para este provedor
          </label>
        </div>

        <div className="modal__footer">
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancelar</button>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving && <Loader2 size={15} className="animate-spin" />}
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
    try { setConfigs(await api.getAiConfigs()); } catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadConfigs(); }, []);

  const handleDelete = async (id: string) => {
    try { await api.deleteAiConfig(id); loadConfigs(); } catch {}
  };

  const grouped: Record<AiProvider, AiConfig[]> = { CLAUDE: [], OPENAI: [], GEMINI: [] };
  configs.forEach((c) => { if (grouped[c.provider]) grouped[c.provider].push(c); });

  return (
    <div className="page-container ai-config">
      <div className="page-header">
        <div className="page-header__info">
          <h1 className="page-header__title">Configurações de I.A.</h1>
          <p className="page-header__subtitle">Gerencie seus provedores de inteligência artificial</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditConfig(null); setShowForm(true); }}>
          <Plus size={16} /> Nova Configuração
        </button>
      </div>

      {loading ? (
        <div className="loader" style={{ height: 160 }}>
          <Loader2 size={18} className="animate-spin" /> Carregando...
        </div>
      ) : configs.length === 0 ? (
        <div className="empty-state">
          <Cpu size={56} className="empty-state__icon" />
          <p className="empty-state__title">Nenhuma configuração de I.A.</p>
          <p className="empty-state__text">
            Adicione uma configuração de Claude, OpenAI ou Gemini para usar I.A. nos seus bots
          </p>
        </div>
      ) : (
        <div className="page-container">
          {(Object.entries(grouped) as [AiProvider, AiConfig[]][]).map(([provider, items]) => {
            if (items.length === 0) return null;
            const info = providerInfo[provider];
            return (
              <div key={provider}>
                <h2 className={`ai-config__provider-heading ${info.colorClass}`}>{info.label}</h2>
                <div className="ai-config__provider-section">
                  {items.map((config) => (
                    <div key={config.id} className="ai-config__card">
                      <div className="ai-config__card-top">
                        <div className="ai-config__card-left">
                          <div className={`ai-config__provider-icon ${info.iconClass}`}>
                            <Cpu size={18} style={{ color: provider === 'CLAUDE' ? '#fb923c' : provider === 'OPENAI' ? '#4ade80' : '#818cf8' }} />
                          </div>
                          <div>
                            <div className="ai-config__card-name-row">
                              <h3 className="ai-config__card-name">{config.name}</h3>
                              {config.isDefault && (
                                <span className="badge badge-yellow">
                                  <Star size={10} /> Padrão
                                </span>
                              )}
                            </div>
                            <p className="ai-config__card-model">
                              Modelo: <span>{config.model}</span>
                            </p>
                          </div>
                        </div>

                        <div className="ai-config__card-actions">
                          <button
                            className="btn btn-icon"
                            onClick={() => { setEditConfig(config); setShowForm(true); }}
                            title="Editar"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            className="btn btn-icon"
                            style={{ color: 'var(--color-text-muted)' }}
                            onClick={() => handleDelete(config.id)}
                            title="Excluir"
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171'; (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = ''; (e.currentTarget as HTMLElement).style.background = ''; }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      <div className="ai-config__card-meta">
                        <span>Max Tokens: <strong>{config.maxTokens.toLocaleString()}</strong></span>
                        <span>Temperatura: <strong>{config.temperature}</strong></span>
                        <span>API Key: <strong>{"•".repeat(8)}{config.apiKey.slice(-4)}</strong></span>
                        {config._count && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Check size={13} /> {config._count.bots} bot{config._count.bots !== 1 ? 's' : ''} vinculado{config._count.bots !== 1 ? 's' : ''}
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
