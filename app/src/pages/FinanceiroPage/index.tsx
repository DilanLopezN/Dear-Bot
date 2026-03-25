import { useState, useEffect, useCallback } from 'react';
import {
  CreditCard, CheckCircle, Crown, Building2, Zap,
  MessageSquare, Bot, ChevronRight, X, Copy, Loader2,
  AlertCircle, QrCode, Lock,
} from 'lucide-react';
import { api, extractApiError } from '@/services/api';
import './FinanceiroPage.css';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PlanInfo {
  plan: string;
  name: string;
  price: number;
  maxBots: number;
  maxDailyMessages: number | string;
  trialDays: number;
  features: string[];
}

interface UserSubscription {
  plan: string;
  planName: string;
  planActive: boolean;
  planExpiresAt: string | null;
  price: number;
  maxBots: number;
  maxDailyMessages: number;
  features: string[];
  subscription: {
    id: string;
    status: string;
    billingType: string;
    value: number;
    nextDueDate: string | null;
    lastPaymentAt: string | null;
    asaasSubscriptionId: string | null;
  } | null;
}

interface PixData {
  encodedImage: string;
  payload: string;
  expirationDate: string;
}

interface PaymentResult {
  message: string;
  plan: string;
  subscriptionId: string;
  value: number;
  billingType: string;
  status: 'ACTIVE' | 'PENDING';
  payment: {
    paymentId: string;
    status: string;
    value: number;
    dueDate: string;
    invoiceUrl?: string;
    pix?: PixData;
    bankSlipUrl?: string;
    identificationField?: string;
    creditCard?: { creditCardBrand?: string; creditCardNumber?: string };
  } | null;
}

type CheckoutStep = 'select-billing' | 'fill-card' | 'pix-result' | 'card-result' | 'boleto-result';

const PLAN_DISPLAY = {
  TESTER: { icon: Zap, color: 'var(--color-text-muted)', label: 'Tester (Grátis)' },
  PRO: { icon: Crown, color: '#f59e0b', label: 'Pro' },
  ENTERPRISE: { icon: Building2, color: 'var(--color-accent)', label: 'Enterprise' },
};

const FEATURE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  bot_keywords: 'Palavras-chave',
  bot_ai: 'IA Claude',
  bot_hybrid: 'Modo Híbrido',
  scheduled_messages: 'Mensagens Agendadas',
  broadcast_lists: 'Listas de Transmissão',
  broadcasts: 'Disparos em Massa',
  reports: 'Relatórios',
  ai_iterations: 'Iterações IA',
  leads: 'Gestão de Leads',
  knowledge_base: 'Base de Conhecimento',
  chat_management: 'Chat ao Vivo',
  whatsapp_instance: 'Instância WhatsApp',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Ativo', color: '#4ade80' },
  OVERDUE: { label: 'Inadimplente', color: '#f87171' },
  EXPIRED: { label: 'Expirado', color: '#f87171' },
  CANCELLED: { label: 'Cancelado', color: '#94a3b8' },
  PENDING: { label: 'Aguardando Pagamento', color: '#fbbf24' },
  RECEIVED: { label: 'Recebido', color: '#4ade80' },
  CONFIRMED: { label: 'Confirmado', color: '#4ade80' },
};

// ─── Checkout Modal ───────────────────────────────────────────────────────────

function CheckoutModal({
  plan,
  onClose,
  onSuccess,
}: {
  plan: PlanInfo;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<CheckoutStep>('select-billing');
  const [billingType, setBillingType] = useState<'PIX' | 'CREDIT_CARD' | 'BOLETO'>('PIX');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  // Polling para verificar se o pagamento foi confirmado (PIX/Boleto)
  useEffect(() => {
    if (!result || result.status !== 'PENDING') return;
    if (paymentConfirmed) return;

    const interval = setInterval(async () => {
      try {
        const status = await api.getSubscriptionStatus();
        if (status?.subscription?.status === 'ACTIVE' && status?.planActive) {
          setPaymentConfirmed(true);
          clearInterval(interval);
          onSuccess();
        }
      } catch { /* ignore polling errors */ }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [result, paymentConfirmed, onSuccess]);

  // Credit card fields
  const [cardHolder, setCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState(''); // MM/AAAA
  const [cardCvv, setCardCvv] = useState('');
  const [cardPostalCode, setCardPostalCode] = useState('');
  const [cardAddressNumber, setCardAddressNumber] = useState('');
  const [cardPhone, setCardPhone] = useState('');
  const [cardEmail, setCardEmail] = useState('');
  const [cardCpfCnpj, setCardCpfCnpj] = useState('');

  const formatCardNumber = (v: string) =>
    v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();

  const formatExpiry = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 6);
    if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmitPix = async () => {
    if (!cpfCnpj.trim()) { setError('Informe o CPF ou CNPJ'); return; }
    setError('');
    setLoading(true);
    try {
      const data = await api.subscribe({ plan: plan.plan as 'PRO' | 'ENTERPRISE', billingType: 'PIX', cpfCnpj: cpfCnpj.replace(/\D/g, '') });
      setResult(data);
      setStep('pix-result');
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCard = async () => {
    setError('');
    if (!cpfCnpj.trim() || !cardHolder || !cardNumber || !cardExpiry || !cardCvv || !cardPostalCode || !cardAddressNumber || !cardPhone || !cardEmail || !cardCpfCnpj) {
      setError('Preencha todos os campos obrigatórios');
      return;
    }
    const [expMonth, expYear] = cardExpiry.split('/');
    if (!expMonth || !expYear || expYear.length < 4) {
      setError('Data de validade inválida (use MM/AAAA)');
      return;
    }
    setLoading(true);
    try {
      const data = await api.subscribe({
        plan: plan.plan as 'PRO' | 'ENTERPRISE',
        billingType: 'CREDIT_CARD',
        cpfCnpj: cpfCnpj.replace(/\D/g, ''),
        creditCard: {
          holderName: cardHolder,
          number: cardNumber.replace(/\s/g, ''),
          expiryMonth: expMonth,
          expiryYear: expYear,
          ccv: cardCvv,
        },
        creditCardHolderInfo: {
          name: cardHolder,
          email: cardEmail,
          cpfCnpj: cardCpfCnpj.replace(/\D/g, ''),
          postalCode: cardPostalCode.replace(/\D/g, ''),
          addressNumber: cardAddressNumber,
          phone: cardPhone.replace(/\D/g, ''),
        },
      });
      setResult(data);
      setStep('card-result');
      onSuccess();
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitBoleto = async () => {
    if (!cpfCnpj.trim()) { setError('Informe o CPF ou CNPJ'); return; }
    setError('');
    setLoading(true);
    try {
      const data = await api.subscribe({ plan: plan.plan as 'PRO' | 'ENTERPRISE', billingType: 'BOLETO', cpfCnpj: cpfCnpj.replace(/\D/g, '') });
      setResult(data);
      setStep('boleto-result');
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="checkout-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="checkout-modal">
        {/* Header */}
        <div className="checkout-header">
          <div>
            <h2 className="checkout-title">Upgrade para {plan.name}</h2>
            <p className="checkout-subtitle">R$ {plan.price}/mês · Cancele quando quiser</p>
          </div>
          <button className="checkout-close" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Step: Select billing */}
        {step === 'select-billing' && (
          <div className="checkout-body">
            <div className="checkout-field">
              <label className="checkout-label">CPF ou CNPJ *</label>
              <input
                className="checkout-input"
                placeholder="000.000.000-00"
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(e.target.value)}
              />
            </div>

            <div className="checkout-field">
              <label className="checkout-label">Forma de pagamento</label>
              <div className="billing-options">
                {(['PIX', 'CREDIT_CARD', 'BOLETO'] as const).map((bt) => (
                  <button
                    key={bt}
                    className={`billing-option${billingType === bt ? ' billing-option--active' : ''}`}
                    onClick={() => setBillingType(bt)}
                  >
                    {bt === 'PIX' && <QrCode size={18} />}
                    {bt === 'CREDIT_CARD' && <CreditCard size={18} />}
                    {bt === 'BOLETO' && <span className="billing-option-icon">$</span>}
                    <span>{bt === 'PIX' ? 'PIX' : bt === 'CREDIT_CARD' ? 'Cartão de Crédito' : 'Boleto'}</span>
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="checkout-error"><AlertCircle size={14} /> {error}</p>}

            <div className="checkout-actions">
              {billingType === 'PIX' && (
                <button className="btn-primary checkout-btn" onClick={handleSubmitPix} disabled={loading}>
                  {loading ? <Loader2 size={16} className="spin" /> : <QrCode size={16} />}
                  Gerar QR Code PIX
                </button>
              )}
              {billingType === 'CREDIT_CARD' && (
                <button className="btn-primary checkout-btn" onClick={() => {
                  if (!cpfCnpj.trim()) { setError('Informe o CPF ou CNPJ'); return; }
                  setError('');
                  setStep('fill-card');
                }}>
                  <CreditCard size={16} /> Informar cartão
                </button>
              )}
              {billingType === 'BOLETO' && (
                <button className="btn-primary checkout-btn" onClick={handleSubmitBoleto} disabled={loading}>
                  {loading ? <Loader2 size={16} className="spin" /> : null}
                  Gerar Boleto
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step: Fill credit card */}
        {step === 'fill-card' && (
          <div className="checkout-body">
            <p className="checkout-section-title"><Lock size={13} /> Dados do cartão (ambiente seguro)</p>

            <div className="checkout-grid-2">
              <div className="checkout-field checkout-field--full">
                <label className="checkout-label">Nome no cartão *</label>
                <input className="checkout-input" placeholder="Como está no cartão" value={cardHolder} onChange={(e) => setCardHolder(e.target.value.toUpperCase())} />
              </div>
              <div className="checkout-field checkout-field--full">
                <label className="checkout-label">Número do cartão *</label>
                <input className="checkout-input" placeholder="0000 0000 0000 0000" value={cardNumber} onChange={(e) => setCardNumber(formatCardNumber(e.target.value))} maxLength={19} />
              </div>
              <div className="checkout-field">
                <label className="checkout-label">Validade *</label>
                <input className="checkout-input" placeholder="MM/AAAA" value={cardExpiry} onChange={(e) => setCardExpiry(formatExpiry(e.target.value))} maxLength={7} />
              </div>
              <div className="checkout-field">
                <label className="checkout-label">CVV *</label>
                <input className="checkout-input" placeholder="123" value={cardCvv} onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))} maxLength={4} />
              </div>
            </div>

            <p className="checkout-section-title" style={{ marginTop: 16 }}>Dados do titular</p>

            <div className="checkout-grid-2">
              <div className="checkout-field checkout-field--full">
                <label className="checkout-label">E-mail *</label>
                <input className="checkout-input" type="email" placeholder="seu@email.com" value={cardEmail} onChange={(e) => setCardEmail(e.target.value)} />
              </div>
              <div className="checkout-field">
                <label className="checkout-label">CPF/CNPJ do titular *</label>
                <input className="checkout-input" placeholder="000.000.000-00" value={cardCpfCnpj} onChange={(e) => setCardCpfCnpj(e.target.value)} />
              </div>
              <div className="checkout-field">
                <label className="checkout-label">Telefone *</label>
                <input className="checkout-input" placeholder="(11) 99999-9999" value={cardPhone} onChange={(e) => setCardPhone(e.target.value)} />
              </div>
              <div className="checkout-field">
                <label className="checkout-label">CEP *</label>
                <input className="checkout-input" placeholder="00000-000" value={cardPostalCode} onChange={(e) => setCardPostalCode(e.target.value)} />
              </div>
              <div className="checkout-field">
                <label className="checkout-label">Número *</label>
                <input className="checkout-input" placeholder="123" value={cardAddressNumber} onChange={(e) => setCardAddressNumber(e.target.value)} />
              </div>
            </div>

            {error && <p className="checkout-error"><AlertCircle size={14} /> {error}</p>}

            <div className="checkout-actions">
              <button className="btn-ghost checkout-btn-secondary" onClick={() => { setStep('select-billing'); setError(''); }}>Voltar</button>
              <button className="btn-primary checkout-btn" onClick={handleSubmitCard} disabled={loading}>
                {loading ? <Loader2 size={16} className="spin" /> : <Lock size={16} />}
                Pagar R$ {plan.price}
              </button>
            </div>
          </div>
        )}

        {/* Step: PIX result */}
        {step === 'pix-result' && result && (
          <div className="checkout-body checkout-result">
            {paymentConfirmed ? (
              <>
                <div className="checkout-success-icon"><CheckCircle size={36} color="#4ade80" /></div>
                <h3 className="checkout-result-title">Pagamento confirmado!</h3>
                <p className="checkout-result-subtitle">
                  Seu plano {plan.name} foi ativado com sucesso.
                </p>
                <button className="btn-primary checkout-btn" onClick={onClose}>Fechar</button>
              </>
            ) : (
              <>
                <div className="checkout-success-icon"><CheckCircle size={36} color="#4ade80" /></div>
                <h3 className="checkout-result-title">Assinatura criada!</h3>
                <p className="checkout-result-subtitle">Escaneie o QR Code ou copie o código PIX para pagar</p>

                {result.payment?.pix?.encodedImage ? (
                  <div className="pix-qr-wrap">
                    <img
                      src={`data:image/png;base64,${result.payment.pix.encodedImage}`}
                      alt="QR Code PIX"
                      className="pix-qr-image"
                    />
                  </div>
                ) : (
                  <div className="pix-qr-fallback">
                    <AlertCircle size={24} color="#fbbf24" />
                    <p>QR Code indisponível no momento. Use o código Copia e Cola abaixo ou acesse a fatura.</p>
                  </div>
                )}

                {result.payment?.pix?.payload && (
                  <div className="pix-copy-wrap">
                    <p className="checkout-label">Código Copia e Cola</p>
                    <div className="pix-copy-row">
                      <span className="pix-copy-code">{result.payment.pix.payload.slice(0, 40)}...</span>
                      <button className="pix-copy-btn" onClick={() => handleCopy(result.payment!.pix!.payload)}>
                        {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                        {copied ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>
                  </div>
                )}

                {result.payment?.invoiceUrl && (
                  <a className="checkout-invoice-link" href={result.payment.invoiceUrl} target="_blank" rel="noopener noreferrer">
                    Abrir fatura completa
                  </a>
                )}

                <p className="checkout-result-note">
                  <Loader2 size={14} className="spin" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                  Aguardando confirmação do pagamento... Seu plano será ativado automaticamente.
                </p>

                <button className="btn-ghost checkout-btn-secondary" onClick={() => { onSuccess(); onClose(); }}>Fechar</button>
              </>
            )}
          </div>
        )}

        {/* Step: Credit card result */}
        {step === 'card-result' && result && (
          <div className="checkout-body checkout-result">
            <div className="checkout-success-icon"><CheckCircle size={36} color="#4ade80" /></div>
            <h3 className="checkout-result-title">Pagamento realizado!</h3>
            <p className="checkout-result-subtitle">
              Plano {plan.name} ativado com sucesso via cartão de crédito.
            </p>
            {result.payment?.creditCard?.creditCardBrand && (
              <p className="checkout-result-note">
                {result.payment.creditCard.creditCardBrand} •••• {result.payment.creditCard.creditCardNumber}
              </p>
            )}
            <p className="checkout-result-note">
              Sua assinatura é recorrente e será cobrada mensalmente no valor de R$ {plan.price}.
            </p>
            {result.payment?.invoiceUrl && (
              <a className="checkout-invoice-link" href={result.payment.invoiceUrl} target="_blank" rel="noopener noreferrer">
                Ver fatura
              </a>
            )}
            <button className="btn-primary checkout-btn" onClick={onClose}>Fechar</button>
          </div>
        )}

        {/* Step: Boleto result */}
        {step === 'boleto-result' && result && (
          <div className="checkout-body checkout-result">
            {paymentConfirmed ? (
              <>
                <div className="checkout-success-icon"><CheckCircle size={36} color="#4ade80" /></div>
                <h3 className="checkout-result-title">Pagamento confirmado!</h3>
                <p className="checkout-result-subtitle">
                  Seu plano {plan.name} foi ativado com sucesso.
                </p>
                <button className="btn-primary checkout-btn" onClick={onClose}>Fechar</button>
              </>
            ) : (
              <>
                <div className="checkout-success-icon"><CheckCircle size={36} color="#4ade80" /></div>
                <h3 className="checkout-result-title">Boleto gerado!</h3>
                <p className="checkout-result-subtitle">Pague o boleto para ativar seu plano {plan.name}.</p>
                {result.payment?.bankSlipUrl ? (
                  <a className="checkout-invoice-link checkout-boleto-btn" href={result.payment.bankSlipUrl} target="_blank" rel="noopener noreferrer">
                    Abrir boleto
                  </a>
                ) : (
                  <div className="pix-qr-fallback">
                    <AlertCircle size={24} color="#fbbf24" />
                    <p>Boleto ainda está sendo gerado. Acesse a fatura abaixo para visualizar.</p>
                  </div>
                )}
                {result.payment?.identificationField && (
                  <div className="pix-copy-wrap">
                    <p className="checkout-label">Linha Digitável (Copia e Cola)</p>
                    <div className="pix-copy-row">
                      <span className="pix-copy-code">{result.payment.identificationField}</span>
                      <button className="pix-copy-btn" onClick={() => handleCopy(result.payment!.identificationField!)}>
                        {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                        {copied ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>
                  </div>
                )}
                {result.payment?.invoiceUrl && (
                  <a className="checkout-invoice-link" href={result.payment.invoiceUrl} target="_blank" rel="noopener noreferrer">
                    Ver fatura
                  </a>
                )}
                <p className="checkout-result-note">
                  <Loader2 size={14} className="spin" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                  Aguardando confirmação do pagamento... Seu plano será ativado automaticamente.
                </p>
                <button className="btn-ghost checkout-btn-secondary" onClick={() => { onSuccess(); onClose(); }}>Fechar</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FinanceiroPage() {
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [userSub, setUserSub] = useState<UserSubscription | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loadingSub, setLoadingSub] = useState(true);
  const [checkoutPlan, setCheckoutPlan] = useState<PlanInfo | null>(null);

  const load = useCallback(async () => {
    setLoadingSub(true);
    try {
      const [plansData, subData] = await Promise.all([
        api.getPlans(),
        api.getUserSubscription(),
      ]);
      setPlans(plansData);
      setUserSub(subData);

      if (subData?.subscription?.asaasSubscriptionId) {
        try {
          const hist = await api.getPaymentHistory();
          setPayments(hist?.data || []);
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ } finally {
      setLoadingSub(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Polling: auto-refresh when subscription is PENDING
  useEffect(() => {
    if (userSub?.subscription?.status !== 'PENDING') return;

    const interval = setInterval(async () => {
      try {
        const status = await api.getSubscriptionStatus();
        if (status?.subscription?.status === 'ACTIVE' && status?.planActive) {
          load(); // Refresh everything
        }
      } catch { /* ignore */ }
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [userSub?.subscription?.status, load]);

  const currentPlan = userSub?.plan || 'TESTER';
  const PlanIcon = PLAN_DISPLAY[currentPlan as keyof typeof PLAN_DISPLAY]?.icon || Zap;
  const planColor = PLAN_DISPLAY[currentPlan as keyof typeof PLAN_DISPLAY]?.color || 'var(--color-text-muted)';

  if (loadingSub) {
    return (
      <div className="page-container financeiro">
        <div className="page-header">
          <div className="page-header__info">
            <h1 className="page-header__title">Financeiro</h1>
            <p className="page-header__subtitle">Gerencie seu plano e pagamentos</p>
          </div>
        </div>
        <div className="financeiro__loading">
          <Loader2 size={28} className="spin" color="var(--color-accent)" />
          <p>Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container financeiro">
      <div className="page-header">
        <div className="page-header__info">
          <h1 className="page-header__title">Financeiro</h1>
          <p className="page-header__subtitle">Gerencie seu plano e pagamentos</p>
        </div>
      </div>

      {/* Current Plan Banner */}
      <div className="financeiro__banner">
        <div className="financeiro__banner-left">
          <div className="financeiro__banner-icon">
            <PlanIcon size={26} color={planColor} />
          </div>
          <div>
            <p className="financeiro__banner-label">Plano atual</p>
            <p className="financeiro__banner-name">{userSub?.planName || 'Tester'}</p>
            {userSub?.subscription && (
              <p className="financeiro__banner-status" style={{ color: STATUS_LABELS[userSub.subscription.status]?.color || '#94a3b8' }}>
                {STATUS_LABELS[userSub.subscription.status]?.label || userSub.subscription.status}
                {userSub.subscription.nextDueDate && ` · Próx. vencimento: ${new Date(userSub.subscription.nextDueDate).toLocaleDateString('pt-BR')}`}
              </p>
            )}
            {currentPlan === 'TESTER' && userSub?.planExpiresAt && (
              <p className="financeiro__banner-status" style={{ color: '#fbbf24' }}>
                Trial expira em {new Date(userSub.planExpiresAt).toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>
        </div>
        <div className="financeiro__banner-right">
          <div className="financeiro__banner-stat">
            <Bot size={15} color="var(--color-text-muted)" />
            {userSub?.maxBots ?? 1} {(userSub?.maxBots ?? 1) === 1 ? 'bot' : 'bots'}
          </div>
          <div className="financeiro__banner-stat">
            <MessageSquare size={15} color="var(--color-text-muted)" />
            {userSub?.maxDailyMessages === -1 ? '∞' : userSub?.maxDailyMessages ?? 100} msg/dia
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid-plans">
        {plans.map((plan) => {
          const isCurrent = plan.plan === currentPlan;
          const icon = PLAN_DISPLAY[plan.plan as keyof typeof PLAN_DISPLAY]?.icon || Zap;
          const color = PLAN_DISPLAY[plan.plan as keyof typeof PLAN_DISPLAY]?.color || 'var(--color-text-muted)';
          const PIcon = icon;

          return (
            <div
              key={plan.plan}
              className={`financeiro__plan-card${isCurrent ? ' financeiro__plan-card--current' : ''}`}
            >
              <div className="financeiro__plan-header">
                <PIcon size={18} style={{ color }} />
                <span className="financeiro__plan-name">{plan.name}</span>
                {isCurrent && <span className="badge badge-accent">Atual</span>}
              </div>

              <p className="financeiro__plan-price">
                {plan.price === 0 ? 'Grátis' : `R$ ${plan.price}`}
                {plan.price > 0 && <span className="financeiro__plan-period">/mês</span>}
              </p>

              <ul className="financeiro__plan-features">
                <li className="financeiro__plan-feature">
                  <CheckCircle size={15} color="#4ade80" style={{ flexShrink: 0 }} />
                  {plan.maxBots} {plan.maxBots === 1 ? 'bot' : 'bots'}
                </li>
                <li className="financeiro__plan-feature">
                  <CheckCircle size={15} color="#4ade80" style={{ flexShrink: 0 }} />
                  {plan.maxDailyMessages === 'Ilimitado' || plan.maxDailyMessages === -1 ? '∞ mensagens/dia' : `${plan.maxDailyMessages} msg/dia`}
                </li>
                {plan.features.map((f) => (
                  <li key={f} className="financeiro__plan-feature">
                    <CheckCircle size={15} color="#4ade80" style={{ flexShrink: 0 }} />
                    {FEATURE_LABELS[f] || f}
                  </li>
                ))}
              </ul>

              <button
                disabled={isCurrent || plan.plan === 'TESTER' || userSub?.subscription?.status === 'PENDING'}
                className={`financeiro__plan-btn ${isCurrent || plan.plan === 'TESTER' || userSub?.subscription?.status === 'PENDING' ? 'financeiro__plan-btn--current' : 'financeiro__plan-btn--upgrade'}`}
                onClick={() => !isCurrent && plan.plan !== 'TESTER' && userSub?.subscription?.status !== 'PENDING' && setCheckoutPlan(plan)}
              >
                {isCurrent
                  ? 'Plano atual'
                  : plan.plan === 'TESTER'
                  ? 'Gratuito'
                  : userSub?.subscription?.status === 'PENDING'
                  ? 'Pagamento pendente'
                  : <><span>Fazer Upgrade</span> <ChevronRight size={15} /></>}
              </button>
            </div>
          );
        })}
      </div>

      {/* Payment History */}
      <div className="financeiro__invoices">
        <h3 className="financeiro__invoices-title">Histórico de Pagamentos</h3>
        {payments.length === 0 ? (
          <p className="financeiro__no-payments">Nenhum pagamento encontrado.</p>
        ) : (
          <div className="financeiro__invoice-list">
            {payments.map((p: any) => {
              const st = STATUS_LABELS[p.status] || { label: p.status, color: '#94a3b8' };
              return (
                <div key={p.id} className="financeiro__invoice-row">
                  <div className="financeiro__invoice-left">
                    <span className="financeiro__invoice-date">
                      {p.dueDate ? new Date(p.dueDate).toLocaleDateString('pt-BR') : '-'}
                    </span>
                    <span className="badge badge-accent">{p.description || 'Assinatura'}</span>
                  </div>
                  <div className="financeiro__invoice-right">
                    <span className="financeiro__invoice-amount">
                      R$ {Number(p.value).toFixed(2).replace('.', ',')}
                    </span>
                    <span className="financeiro__invoice-status" style={{ color: st.color }}>
                      <CheckCircle size={13} /> {st.label}
                    </span>
                    {p.invoiceUrl && (
                      <a href={p.invoiceUrl} target="_blank" rel="noopener noreferrer" className="financeiro__invoice-link">
                        Ver fatura
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Checkout Modal */}
      {checkoutPlan && (
        <CheckoutModal
          plan={checkoutPlan}
          onClose={() => setCheckoutPlan(null)}
          onSuccess={load}
        />
      )}
    </div>
  );
}
