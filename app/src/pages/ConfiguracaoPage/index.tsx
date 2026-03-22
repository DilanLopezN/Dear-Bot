import { useEffect, useState, useCallback } from 'react';
import {
  Smartphone,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  QrCode,
  Zap,
  Crown,
  Building2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, extractApiError } from '@/services/api';
import './ConfiguracaoPage.css';

interface EvolutionInstance {
  id: string;
  userId: string;
  instanceName: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'QRCODE';
  phoneNumber?: string;
  createdAt: string;
}

interface PlanConfig {
  name: string;
  maxBots: number;
  maxDailyMessages: number;
  price: number;
}

interface InstanceData {
  instance: EvolutionInstance | null;
  plan: 'TESTER' | 'PRO' | 'ENTERPRISE';
  planActive: boolean;
  planConfig: PlanConfig;
}

const STATUS_CONFIG = {
  CONNECTED: {
    label: 'Conectado',
    icon: CheckCircle,
    color: '#4ade80',
    bgColor: 'rgba(74, 222, 128, 0.1)',
  },
  DISCONNECTED: {
    label: 'Desconectado',
    icon: XCircle,
    color: '#f87171',
    bgColor: 'rgba(248, 113, 113, 0.1)',
  },
  CONNECTING: {
    label: 'Conectando...',
    icon: Loader2,
    color: '#fb923c',
    bgColor: 'rgba(251, 146, 60, 0.1)',
  },
  QRCODE: {
    label: 'Aguardando QR Code',
    icon: QrCode,
    color: '#818cf8',
    bgColor: 'rgba(129, 140, 248, 0.1)',
  },
};

const PLAN_ICONS = {
  TESTER: Zap,
  PRO: Crown,
  ENTERPRISE: Building2,
};

const PLAN_COLORS = {
  TESTER: 'var(--color-text-muted)',
  PRO: '#f59e0b',
  ENTERPRISE: 'var(--color-accent)',
};

export default function ConfiguracaoPage() {
  const [data, setData] = useState<InstanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [qrData, setQrData] = useState<{ base64?: string; code?: string } | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const loadInstance = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getConfigInstance();
      setData(result);
    } catch (err) {
      toast.error(extractApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInstance();
  }, [loadInstance]);

  // Auto-refresh status when QRCODE or CONNECTING
  useEffect(() => {
    if (!data?.instance) return;
    const status = data.instance.status;
    if (status !== 'QRCODE' && status !== 'CONNECTING') return;

    const interval = setInterval(async () => {
      try {
        const statusResult = await api.getConfigInstanceStatus();
        const newStatus = statusResult.localStatus || statusResult.status;
        if (newStatus && newStatus !== data.instance?.status) {
          setData((prev) =>
            prev && prev.instance
              ? { ...prev, instance: { ...prev.instance, status: newStatus } }
              : prev,
          );
          if (newStatus === 'CONNECTED') {
            toast.success('WhatsApp conectado com sucesso!');
            setQrData(null);
          }
        }
      } catch {}
    }, 5000);

    return () => clearInterval(interval);
  }, [data?.instance?.status]);

  // Auto-refresh QR code every 30s (it expires every ~40s)
  useEffect(() => {
    if (!data?.instance) return;
    const status = data.instance.status;
    if (status !== 'QRCODE' && status !== 'CONNECTING') return;
    if (!qrData) return; // Only refresh if QR is already being shown

    const interval = setInterval(async () => {
      try {
        const result = await api.getConfigInstanceQrCode();
        if (result?.base64 || result?.code || result?.pairingCode) {
          setQrData({ base64: result.base64, code: result.code || result.pairingCode });
        }
      } catch {}
    }, 30000);

    return () => clearInterval(interval);
  }, [data?.instance?.status, !!qrData]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const createResult = await api.createConfigInstance();
      toast.success('Instância criada! Escaneie o QR Code para conectar o WhatsApp.');
      await loadInstance();

      // Try to extract QR code from creation response first
      const evoData = createResult?.evolutionData;
      if (evoData?.base64 || evoData?.code || evoData?.pairingCode) {
        setQrData({ base64: evoData.base64, code: evoData.code || evoData.pairingCode });
      } else {
        // Fallback: fetch QR code separately
        await handleLoadQr();
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const message = extractApiError(err);
      if (status === 403) {
        toast.error(message, {
          description: 'Acesse a página Financeiro para atualizar seu plano.',
          duration: 8000,
        });
      } else {
        toast.error(message);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleLoadQr = async () => {
    setLoadingQr(true);
    setQrData(null);
    try {
      const result = await api.getConfigInstanceQrCode();
      if (result?.base64 || result?.code || result?.pairingCode) {
        setQrData({ base64: result.base64, code: result.code || result.pairingCode });
      } else {
        toast.info('QR Code ainda não disponível. Aguarde alguns segundos e tente novamente.');
      }
    } catch (err) {
      toast.error(extractApiError(err));
    } finally {
      setLoadingQr(false);
    }
  };

  const handleCheckStatus = async () => {
    setCheckingStatus(true);
    try {
      const result = await api.getConfigInstanceStatus();
      const newStatus = result.localStatus || result.status;
      if (newStatus && data?.instance && newStatus !== data.instance.status) {
        setData((prev) =>
          prev && prev.instance
            ? { ...prev, instance: { ...prev.instance, status: newStatus } }
            : prev,
        );
        if (newStatus === 'CONNECTED') {
          toast.success('WhatsApp conectado!');
          setQrData(null);
        } else {
          toast.info(`Status atualizado: ${STATUS_CONFIG[newStatus as keyof typeof STATUS_CONFIG]?.label || newStatus}`);
        }
      } else {
        toast.info('Status verificado.');
      }
    } catch (err) {
      toast.error(extractApiError(err));
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja remover a instância? O WhatsApp será desconectado.')) return;
    setDeleting(true);
    try {
      await api.deleteConfigInstance();
      toast.success('Instância removida com sucesso.');
      setQrData(null);
      await loadInstance();
    } catch (err) {
      toast.error(extractApiError(err));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loader" style={{ height: 200 }}>
          <Loader2 size={20} className="animate-spin" /> Carregando...
        </div>
      </div>
    );
  }

  const instance = data?.instance;
  const plan = data?.plan || 'TESTER';
  const planConfig = data?.planConfig;
  const PlanIcon = PLAN_ICONS[plan];
  const planColor = PLAN_COLORS[plan];
  const statusConfig = instance ? STATUS_CONFIG[instance.status] : null;
  const StatusIcon = statusConfig?.icon;

  const isConnected = instance?.status === 'CONNECTED';
  const needsQr = instance?.status === 'QRCODE' || instance?.status === 'DISCONNECTED' || instance?.status === 'CONNECTING';

  return (
    <div className="page-container configuracao">
      <div className="page-header">
        <div className="page-header__info">
          <h1 className="page-header__title">Configuração</h1>
          <p className="page-header__subtitle">Gerencie sua instância WhatsApp via Evolution API</p>
        </div>
      </div>

      {/* Plan Info Banner */}
      <div className="configuracao__plan-banner">
        <div className="configuracao__plan-banner-left">
          <div className="configuracao__plan-icon" style={{ background: `${planColor}1a` }}>
            <PlanIcon size={22} style={{ color: planColor }} />
          </div>
          <div>
            <p className="configuracao__plan-label">Plano atual</p>
            <p className="configuracao__plan-name">{planConfig?.name || plan}</p>
          </div>
        </div>
        <div className="configuracao__plan-stats">
          <div className="configuracao__plan-stat">
            <span className="configuracao__plan-stat-label">Bots</span>
            <span className="configuracao__plan-stat-value">{planConfig?.maxBots}</span>
          </div>
          <div className="configuracao__plan-stat">
            <span className="configuracao__plan-stat-label">Msg/dia</span>
            <span className="configuracao__plan-stat-value">
              {planConfig?.maxDailyMessages === -1 ? '∞' : planConfig?.maxDailyMessages?.toLocaleString()}
            </span>
          </div>
          {plan !== 'TESTER' && (
            <div className="configuracao__plan-stat">
              <span className="configuracao__plan-stat-label">Preço</span>
              <span className="configuracao__plan-stat-value">R$ {planConfig?.price}/mês</span>
            </div>
          )}
        </div>
      </div>

      {/* Plan inactive warning */}
      {data && !data.planActive && (
        <div className="configuracao__upgrade-hint" style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(248, 113, 113, 0.1)', borderColor: '#f87171' }}>
          <XCircle size={15} color="#f87171" />
          <span>
            Seu plano está inativo. Para criar ou usar instâncias WhatsApp,{' '}
            <a href="#/financeiro" className="configuracao__upgrade-link">atualize seu plano</a>.
          </span>
        </div>
      )}

      {/* Instance Card */}
      <div className="configuracao__section">
        <div className="configuracao__section-header">
          <Smartphone size={18} color="var(--color-accent)" />
          <h2 className="configuracao__section-title">Instância WhatsApp</h2>
        </div>

        {!instance ? (
          /* No Instance */
          <div className="configuracao__empty">
            <div className="configuracao__empty-icon">
              <WifiOff size={40} color="var(--color-text-muted)" />
            </div>
            <p className="configuracao__empty-title">Nenhuma instância configurada</p>
            <p className="configuracao__empty-text">
              Crie uma instância para conectar seu WhatsApp e automatizar mensagens com os seus bots.
            </p>
            <button
              className="btn btn-primary configuracao__create-btn"
              onClick={handleCreate}
              disabled={creating || !data?.planActive}
            >
              {creating ? (
                <><Loader2 size={15} className="animate-spin" /> Criando instância...</>
              ) : (
                <><Plus size={15} /> Criar Instância WhatsApp</>
              )}
            </button>
          </div>
        ) : (
          /* Instance Exists */
          <div className="configuracao__instance">
            {/* Status Row */}
            <div className="configuracao__instance-header">
              <div className="configuracao__instance-info">
                <div
                  className="configuracao__status-badge"
                  style={{ background: statusConfig?.bgColor, color: statusConfig?.color }}
                >
                  {StatusIcon && (
                    <StatusIcon
                      size={14}
                      className={instance.status === 'CONNECTING' ? 'animate-spin' : ''}
                    />
                  )}
                  {statusConfig?.label}
                </div>
                <div className="configuracao__instance-name">
                  <span className="configuracao__instance-label">Instância:</span>
                  <code className="configuracao__instance-code">{instance.instanceName}</code>
                </div>
                {instance.phoneNumber && (
                  <div className="configuracao__instance-phone">
                    <span className="configuracao__instance-label">Número:</span>
                    <span>{instance.phoneNumber}</span>
                  </div>
                )}
              </div>

              <div className="configuracao__instance-actions">
                <button
                  className="btn btn-secondary"
                  onClick={handleCheckStatus}
                  disabled={checkingStatus}
                  title="Verificar status"
                >
                  {checkingStatus ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                  Verificar
                </button>
                <button
                  className="btn btn-danger"
                  onClick={handleDelete}
                  disabled={deleting}
                  title="Remover instância"
                >
                  {deleting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                  Remover
                </button>
              </div>
            </div>

            {/* Connection Status Info */}
            {isConnected && (
              <div className="configuracao__connected-banner">
                <Wifi size={18} color="#4ade80" />
                <div>
                  <p className="configuracao__connected-title">WhatsApp conectado!</p>
                  <p className="configuracao__connected-text">
                    Sua instância está ativa e pronta para receber mensagens dos seus bots.
                  </p>
                </div>
              </div>
            )}

            {/* QR Code Section */}
            {needsQr && (
              <div className="configuracao__qr-section">
                <div className="configuracao__qr-header">
                  <AlertCircle size={16} color="#fb923c" />
                  <p className="configuracao__qr-info">
                    {instance.status === 'DISCONNECTED'
                      ? 'Instância desconectada. Escaneie o QR Code para reconectar.'
                      : 'Escaneie o QR Code com o WhatsApp para conectar.'}
                  </p>
                </div>

                {!qrData ? (
                  <button
                    className="btn btn-primary configuracao__qr-btn"
                    onClick={handleLoadQr}
                    disabled={loadingQr}
                  >
                    {loadingQr ? (
                      <><Loader2 size={15} className="animate-spin" /> Carregando QR Code...</>
                    ) : (
                      <><QrCode size={15} /> Mostrar QR Code</>
                    )}
                  </button>
                ) : (
                  <div className="configuracao__qr-container">
                    {qrData.base64 && (
                      <div className="configuracao__qr-image-wrapper">
                        <img
                          src={
                            qrData.base64.startsWith('data:')
                              ? qrData.base64
                              : `data:image/png;base64,${qrData.base64}`
                          }
                          alt="QR Code WhatsApp"
                          className="configuracao__qr-image"
                        />
                      </div>
                    )}
                    {qrData.code && !qrData.base64 && (
                      <div className="configuracao__qr-code-text">
                        <p className="configuracao__qr-code-label">Código de pareamento:</p>
                        <code className="configuracao__qr-code-value">{qrData.code}</code>
                      </div>
                    )}
                    <div className="configuracao__qr-instructions">
                      <p>1. Abra o WhatsApp no seu celular</p>
                      <p>2. Vá em Configurações → Dispositivos conectados</p>
                      <p>3. Toque em "Conectar um dispositivo"</p>
                      <p>4. Escaneie o QR Code acima</p>
                    </div>
                    <button
                      className="btn btn-secondary configuracao__qr-refresh"
                      onClick={handleLoadQr}
                      disabled={loadingQr}
                    >
                      {loadingQr ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <RefreshCw size={14} />
                      )}
                      Atualizar QR Code
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Plan Features Info */}
      <div className="configuracao__section">
        <div className="configuracao__section-header">
          <Crown size={18} color="var(--color-accent)" />
          <h2 className="configuracao__section-title">Recursos do seu plano</h2>
        </div>
        <div className="configuracao__features-grid">
          <div className="configuracao__feature-item">
            <CheckCircle size={15} color="#4ade80" />
            <span>1 Instância WhatsApp</span>
          </div>
          <div className="configuracao__feature-item">
            <CheckCircle size={15} color="#4ade80" />
            <span>{planConfig?.maxBots} {planConfig?.maxBots === 1 ? 'Bot' : 'Bots'}</span>
          </div>
          <div className="configuracao__feature-item">
            <CheckCircle size={15} color="#4ade80" />
            <span>
              {planConfig?.maxDailyMessages === -1
                ? 'Mensagens ilimitadas'
                : `${planConfig?.maxDailyMessages?.toLocaleString()} mensagens/dia`}
            </span>
          </div>
          {plan !== 'TESTER' && (
            <>
              <div className="configuracao__feature-item">
                <CheckCircle size={15} color="#4ade80" />
                <span>Automação com I.A.</span>
              </div>
              <div className="configuracao__feature-item">
                <CheckCircle size={15} color="#4ade80" />
                <span>Agendamentos de mensagens</span>
              </div>
              <div className="configuracao__feature-item">
                <CheckCircle size={15} color="#4ade80" />
                <span>Transmissões em massa</span>
              </div>
            </>
          )}
          {plan === 'ENTERPRISE' && (
            <div className="configuracao__feature-item">
              <CheckCircle size={15} color="#4ade80" />
              <span>Suporte prioritário</span>
            </div>
          )}
        </div>

        {plan === 'TESTER' && (
          <div className="configuracao__upgrade-hint">
            <AlertCircle size={15} color="#fb923c" />
            <span>
              Você está no plano Tester (gratuito, 3 dias). Para mais bots, mensagens e recursos de I.A.,
              faça upgrade na página{' '}
              <a href="#/financeiro" className="configuracao__upgrade-link">Financeiro</a>.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
