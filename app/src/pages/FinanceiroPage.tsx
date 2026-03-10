import { useState } from 'react';
import {
  CreditCard, CheckCircle, Crown, Building2, Zap,
  MessageSquare, Bot, ChevronRight,
} from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  price: string;
  icon: typeof Crown;
  color: string;
  features: string[];
  limits: { bots: number | string; messages: string; keywords: string };
  current?: boolean;
}

const plans: Plan[] = [
  {
    id: 'FREE',
    name: 'Free',
    price: 'R$ 0',
    icon: Zap,
    color: 'var(--color-text-muted)',
    features: ['1 bot', '100 mensagens/mês', '10 keywords', 'Modo Keywords'],
    limits: { bots: 1, messages: '100/mês', keywords: '10' },
    current: true,
  },
  {
    id: 'PRO',
    name: 'Pro',
    price: 'R$ 97',
    icon: Crown,
    color: '#f59e0b',
    features: ['5 bots', '5.000 mensagens/mês', 'Keywords ilimitadas', 'IA Claude', 'Modo Híbrido', 'Menus interativos', 'Suporte prioritário'],
    limits: { bots: 5, messages: '5.000/mês', keywords: 'Ilimitadas' },
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    price: 'R$ 297',
    icon: Building2,
    color: 'var(--color-accent)',
    features: ['Bots ilimitados', 'Mensagens ilimitadas', 'Keywords ilimitadas', 'IA Claude avançada', 'Menus interativos', 'API personalizada', 'Suporte dedicado', 'SLA 99.9%'],
    limits: { bots: '∞', messages: 'Ilimitadas', keywords: 'Ilimitadas' },
  },
];

const invoices = [
  { id: 1, date: '01/03/2026', plan: 'Free', amount: 'R$ 0,00', status: 'Pago' },
  { id: 2, date: '01/02/2026', plan: 'Free', amount: 'R$ 0,00', status: 'Pago' },
  { id: 3, date: '01/01/2026', plan: 'Free', amount: 'R$ 0,00', status: 'Pago' },
];

export default function FinanceiroPage() {
  const [currentPlan] = useState('FREE');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>Financeiro</h1>
        <p className="text-base text-[var(--color-text-secondary)] mt-2">Gerencie seu plano e pagamentos</p>
      </div>

      {/* Current Plan Banner */}
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-7 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-[var(--color-accent-glow)] flex items-center justify-center">
            <CreditCard className="w-7 h-7 text-[var(--color-accent)]" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Plano atual</p>
            <p className="text-xl font-bold text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>Free</p>
          </div>
        </div>
        <div className="flex items-center gap-8 text-sm text-[var(--color-text-secondary)]">
          <div className="flex items-center gap-2.5"><Bot className="w-4 h-4" /> 1 bot</div>
          <div className="flex items-center gap-2.5"><MessageSquare className="w-4 h-4" /> 100 msg/mês</div>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`bg-[var(--color-bg-card)] border rounded-2xl p-7 transition-all ${
              plan.id === currentPlan
                ? 'border-[var(--color-accent)] shadow-lg shadow-[var(--color-accent-glow)]'
                : 'border-[var(--color-border)] hover:border-[var(--color-border-light)]'
            }`}
          >
            <div className="flex items-center gap-3 mb-6">
              <plan.icon className="w-5 h-5" style={{ color: plan.color }} />
              <span className="text-base font-semibold text-[var(--color-text-primary)]">{plan.name}</span>
              {plan.id === currentPlan && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-accent-glow)] text-[var(--color-accent)] font-medium">Atual</span>
              )}
            </div>

            <p className="text-3xl font-bold text-[var(--color-text-primary)] mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              {plan.price}<span className="text-sm font-normal text-[var(--color-text-muted)] ml-1">/mês</span>
            </p>

            <ul className="mt-7 space-y-3.5">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
                  <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            <button
              className={`mt-8 w-full py-3.5 rounded-xl text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-2 ${
                plan.id === currentPlan
                  ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] cursor-default'
                  : 'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white shadow-lg shadow-[var(--color-accent-glow)]'
              }`}
              disabled={plan.id === currentPlan}
            >
              {plan.id === currentPlan ? 'Plano atual' : <>Upgrade <ChevronRight className="w-4 h-4" /></>}
            </button>
          </div>
        ))}
      </div>

      {/* Invoices */}
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-5 uppercase tracking-wider">Histórico de Pagamentos</h3>
        <div className="space-y-2.5">
          {invoices.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-bg-tertiary)]">
              <div className="flex items-center gap-5">
                <span className="text-sm text-[var(--color-text-primary)]">{inv.date}</span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-accent-glow)] text-[var(--color-accent)] font-medium">{inv.plan}</span>
              </div>
              <div className="flex items-center gap-5">
                <span className="text-sm text-[var(--color-text-primary)]">{inv.amount}</span>
                <span className="text-xs text-green-400 flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> {inv.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
