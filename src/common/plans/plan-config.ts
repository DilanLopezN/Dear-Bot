import { SubscriptionPlan } from '@prisma/client';

export type PlanFeature =
  | 'dashboard'
  | 'bot_keywords'
  | 'bot_ai'
  | 'bot_hybrid'
  | 'scheduled_messages'
  | 'broadcast_lists'
  | 'broadcasts'
  | 'reports'
  | 'ai_iterations'
  | 'leads'
  | 'knowledge_base'
  | 'chat_management';

export interface PlanConfig {
  name: string;
  maxBots: number;
  maxDailyMessages: number; // -1 = ilimitado
  trialDays: number; // 0 = sem trial
  price: number; // em reais
  features: PlanFeature[];
}

export const PLAN_CONFIGS: Record<SubscriptionPlan, PlanConfig> = {
  TESTER: {
    name: 'Tester',
    maxBots: 1,
    maxDailyMessages: 100,
    trialDays: 3,
    price: 0,
    features: [
      'dashboard',
      'bot_keywords',
    ],
  },
  PRO: {
    name: 'Pro',
    maxBots: 2,
    maxDailyMessages: 2000,
    trialDays: 0,
    price: 59,
    features: [
      'dashboard',
      'bot_keywords',
      'bot_ai',
      'bot_hybrid',
      'scheduled_messages',
      'broadcast_lists',
      'broadcasts',
      'reports',
      'ai_iterations',
      'leads',
      'knowledge_base',
      'chat_management',
    ],
  },
  ENTERPRISE: {
    name: 'Enterprise',
    maxBots: 10,
    maxDailyMessages: -1,
    trialDays: 0,
    price: 750,
    features: [
      'dashboard',
      'bot_keywords',
      'bot_ai',
      'bot_hybrid',
      'scheduled_messages',
      'broadcast_lists',
      'broadcasts',
      'reports',
      'ai_iterations',
      'leads',
      'knowledge_base',
      'chat_management',
    ],
  },
};

export function getPlanConfig(plan: SubscriptionPlan): PlanConfig {
  return PLAN_CONFIGS[plan];
}

export function hasFeature(plan: SubscriptionPlan, feature: PlanFeature): boolean {
  return PLAN_CONFIGS[plan].features.includes(feature);
}
