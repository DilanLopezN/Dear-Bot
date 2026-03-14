import { useState } from 'react';
import {
  CreditCard, CheckCircle, Crown, Building2, Zap,
  MessageSquare, Bot, ChevronRight,
} from 'lucide-react';
import './FinanceiroPage.css';

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
            <CreditCard size={26} color="var(--color-accent)" />
          </div>
          <div>
            <p className="financeiro__banner-label">Plano atual</p>
            <p className="financeiro__banner-name">Free</p>
          </div>
        </div>
        <div className="financeiro__banner-right">
          <div className="financeiro__banner-stat">
            <Bot size={15} color="var(--color-text-muted)" /> 1 bot
          </div>
          <div className="financeiro__banner-stat">
            <MessageSquare size={15} color="var(--color-text-muted)" /> 100 msg/mês
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid-plans">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`financeiro__plan-card${plan.id === currentPlan ? ' financeiro__plan-card--current' : ''}`}
          >
            <div className="financeiro__plan-header">
              <plan.icon size={18} style={{ color: plan.color }} />
              <span className="financeiro__plan-name">{plan.name}</span>
              {plan.id === currentPlan && (
                <span className="badge badge-accent">Atual</span>
              )}
            </div>

            <p className="financeiro__plan-price">
              {plan.price}
              <span className="financeiro__plan-period">/mês</span>
            </p>

            <ul className="financeiro__plan-features">
              {plan.features.map((f) => (
                <li key={f} className="financeiro__plan-feature">
                  <CheckCircle size={15} color="#4ade80" style={{ flexShrink: 0 }} />
                  {f}
                </li>
              ))}
            </ul>

            <button
              disabled={plan.id === currentPlan}
              className={`financeiro__plan-btn ${plan.id === currentPlan ? 'financeiro__plan-btn--current' : 'financeiro__plan-btn--upgrade'}`}
            >
              {plan.id === currentPlan ? 'Plano atual' : <><span>Upgrade</span> <ChevronRight size={15} /></>}
            </button>
          </div>
        ))}
      </div>

      {/* Invoices */}
      <div className="financeiro__invoices">
        <h3 className="financeiro__invoices-title">Histórico de Pagamentos</h3>
        <div className="financeiro__invoice-list">
          {invoices.map((inv) => (
            <div key={inv.id} className="financeiro__invoice-row">
              <div className="financeiro__invoice-left">
                <span className="financeiro__invoice-date">{inv.date}</span>
                <span className="badge badge-accent">{inv.plan}</span>
              </div>
              <div className="financeiro__invoice-right">
                <span className="financeiro__invoice-amount">{inv.amount}</span>
                <span className="financeiro__invoice-status">
                  <CheckCircle size={13} /> {inv.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
