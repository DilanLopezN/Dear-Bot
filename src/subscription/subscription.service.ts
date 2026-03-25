import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AsaasService } from './asaas.service';
import { PLAN_CONFIGS } from '../common/plans/plan-config';
import { SubscriptionPlan } from '@prisma/client';
import { CreditCardDto, CreditCardHolderInfoDto } from './dto/subscription.dto';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private prisma: PrismaService,
    private asaas: AsaasService,
  ) {}

  async getPlans() {
    return Object.entries(PLAN_CONFIGS).map(([key, config]) => ({
      plan: key,
      name: config.name,
      price: config.price,
      maxBots: config.maxBots,
      maxDailyMessages: config.maxDailyMessages === -1 ? 'Ilimitado' : config.maxDailyMessages,
      trialDays: config.trialDays,
      features: config.features,
    }));
  }

  async getUserSubscription(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const config = PLAN_CONFIGS[user.plan];
    return {
      plan: user.plan,
      planName: config.name,
      planActive: user.planActive,
      planExpiresAt: user.planExpiresAt,
      price: config.price,
      maxBots: config.maxBots,
      maxDailyMessages: config.maxDailyMessages,
      features: config.features,
      subscription: user.subscription,
    };
  }

  async subscribe(
    userId: string,
    plan: 'PRO' | 'ENTERPRISE',
    billingType: string,
    cpfCnpj: string,
    creditCard?: CreditCardDto,
    creditCardHolderInfo?: CreditCardHolderInfoDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    // Bloquear se já possui assinatura ativa do mesmo plano
    if (user.subscription?.status === 'ACTIVE' && user.plan === plan) {
      throw new BadRequestException('Você já possui uma assinatura ativa deste plano');
    }

    // Bloquear se já existe um pagamento pendente (só permite um por vez)
    if (user.subscription?.status === 'PENDING') {
      throw new BadRequestException(
        'Você já possui um pagamento pendente. Aguarde a confirmação ou cancele a assinatura atual antes de criar uma nova.',
      );
    }

    if (billingType === 'CREDIT_CARD' && (!creditCard || !creditCardHolderInfo)) {
      throw new BadRequestException('Dados do cartão de crédito são obrigatórios para este método de pagamento');
    }

    const config = PLAN_CONFIGS[plan as SubscriptionPlan];

    // Criar ou reutilizar cliente no Asaas
    let asaasCustomerId = user.asaasCustomerId;
    if (!asaasCustomerId) {
      const customer = await this.asaas.createCustomer({
        name: user.name,
        email: user.email,
        cpfCnpj,
        externalReference: user.id,
      });
      asaasCustomerId = customer.id;

      await this.prisma.user.update({
        where: { id: userId },
        data: { asaasCustomerId, cpfCnpj },
      });
    }

    // Cancelar assinatura anterior no Asaas se existir
    if (user.subscription?.asaasSubscriptionId) {
      try {
        await this.asaas.cancelSubscription(user.subscription.asaasSubscriptionId);
      } catch {
        this.logger.warn('Falha ao cancelar assinatura anterior no Asaas');
      }
    }

    if (!asaasCustomerId) {
      throw new BadRequestException('Falha ao criar cliente no Asaas');
    }

    // Criar assinatura no Asaas
    // Para PIX/BOLETO: vencimento hoje para gerar QR Code e boleto imediatamente
    // Para CREDIT_CARD: cobrança imediata, mas nextDueDate define o ciclo
    const nextDueDate = new Date();
    if (billingType === 'CREDIT_CARD') {
      nextDueDate.setDate(nextDueDate.getDate() + 1);
    }
    const formattedDate = nextDueDate.toISOString().slice(0, 10);

    const asaasSubscription = await this.asaas.createSubscription({
      customer: asaasCustomerId,
      billingType: billingType as 'BOLETO' | 'CREDIT_CARD' | 'PIX',
      value: config.price,
      nextDueDate: formattedDate,
      cycle: 'MONTHLY',
      description: `Dear-Bot Plano ${config.name}`,
      externalReference: userId,
      creditCard,
      creditCardHolderInfo,
    });

    // Salvar ou atualizar subscription no banco
    const subscriptionData = {
      plan: plan as SubscriptionPlan,
      status: billingType === 'CREDIT_CARD' ? 'ACTIVE' as const : 'PENDING' as const,
      value: config.price,
      billingType,
      asaasSubscriptionId: asaasSubscription.id,
      nextDueDate: new Date(formattedDate),
    };

    if (user.subscription) {
      await this.prisma.subscription.update({
        where: { id: user.subscription.id },
        data: subscriptionData,
      });
    } else {
      await this.prisma.subscription.create({
        data: {
          userId,
          ...subscriptionData,
        },
      });
    }

    // Atualizar plano do usuário
    // Para CREDIT_CARD: cobrança é imediata, atualiza plano e ativa
    // Para PIX/BOLETO: NÃO atualizar plano ainda - manter plano atual até confirmação do pagamento via webhook
    // O plano alvo fica salvo na subscription e será aplicado quando o webhook PAYMENT_CONFIRMED chegar
    if (billingType === 'CREDIT_CARD') {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          plan: plan as SubscriptionPlan,
          planActive: true,
          planExpiresAt: null,
        },
      });
    }
    // Para PIX/BOLETO: não mexe no user.plan nem no planActive - o usuário mantém acesso ao plano atual

    this.logger.log(`Usuário ${userId} assinou plano ${plan} via ${billingType}`);

    // Buscar dados do pagamento gerado pela assinatura
    let paymentInfo: any = null;
    try {
      const payments = await this.asaas.getSubscriptionPaymentsWithRetry(asaasSubscription.id);
      const firstPayment = payments?.data?.[0];

      if (firstPayment) {
        if (billingType === 'PIX') {
          try {
            const pixData = await this.asaas.getPaymentPixQrCodeWithRetry(firstPayment.id);
            paymentInfo = {
              paymentId: firstPayment.id,
              status: firstPayment.status,
              value: firstPayment.value,
              dueDate: firstPayment.dueDate,
              invoiceUrl: firstPayment.invoiceUrl,
              pix: {
                encodedImage: pixData.encodedImage,
                payload: pixData.payload,
                expirationDate: pixData.expirationDate,
              },
            };
          } catch (err) {
            this.logger.warn(`Falha ao buscar QR Code PIX: ${err.message}`);
            paymentInfo = {
              paymentId: firstPayment.id,
              status: firstPayment.status,
              value: firstPayment.value,
              dueDate: firstPayment.dueDate,
              invoiceUrl: firstPayment.invoiceUrl,
            };
          }
        } else if (billingType === 'CREDIT_CARD') {
          paymentInfo = {
            paymentId: firstPayment.id,
            status: firstPayment.status,
            value: firstPayment.value,
            dueDate: firstPayment.dueDate,
            invoiceUrl: firstPayment.invoiceUrl,
            creditCard: {
              creditCardBrand: firstPayment.creditCard?.creditCardBrand,
              creditCardNumber: firstPayment.creditCard?.creditCardNumber,
            },
          };
        } else {
          // BOLETO - buscar dados completos com retry (bankSlipUrl e linha digitável podem demorar)
          try {
            const fullPayment = await this.asaas.getPaymentWithRetry(firstPayment.id);
            paymentInfo = {
              paymentId: firstPayment.id,
              status: firstPayment.status,
              value: firstPayment.value,
              dueDate: firstPayment.dueDate,
              invoiceUrl: fullPayment?.invoiceUrl || firstPayment.invoiceUrl,
              bankSlipUrl: fullPayment?.bankSlipUrl || firstPayment.bankSlipUrl,
              identificationField: fullPayment?.identificationField,
            };
          } catch {
            this.logger.warn('Falha ao buscar dados completos do boleto');
            paymentInfo = {
              paymentId: firstPayment.id,
              status: firstPayment.status,
              value: firstPayment.value,
              dueDate: firstPayment.dueDate,
              invoiceUrl: firstPayment.invoiceUrl,
              bankSlipUrl: firstPayment.bankSlipUrl,
            };
          }
        }
      }
    } catch (err) {
      this.logger.warn(`Falha ao buscar dados do pagamento: ${err.message}`);
    }

    return {
      message: `Assinatura do plano ${config.name} criada com sucesso`,
      plan,
      subscriptionId: asaasSubscription.id,
      value: config.price,
      billingType,
      status: billingType === 'CREDIT_CARD' ? 'ACTIVE' : 'PENDING',
      payment: paymentInfo,
    };
  }

  async cancelSubscription(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    if (!user.subscription) throw new BadRequestException('Nenhuma assinatura encontrada');

    // Cancelar no Asaas
    if (user.subscription.asaasSubscriptionId) {
      await this.asaas.cancelSubscription(user.subscription.asaasSubscriptionId);
    }

    // Atualizar no banco
    await this.prisma.subscription.update({
      where: { id: user.subscription.id },
      data: { status: 'CANCELLED' },
    });

    // Voltar para plano tester
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        plan: 'TESTER',
        planActive: true,
        planExpiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
    });

    return { message: 'Assinatura cancelada. Você foi movido para o plano Tester.' };
  }

  async getPaymentHistory(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    if (!user.subscription?.asaasSubscriptionId) {
      return { data: [] };
    }

    try {
      const payments = await this.asaas.getSubscriptionPayments(user.subscription.asaasSubscriptionId);
      return payments;
    } catch (err) {
      this.logger.warn(`Falha ao buscar histórico de pagamentos: ${err.message}`);
      return { data: [] };
    }
  }

  // ─── Webhook do Asaas ──────────────────────────────────────────────────────

  async handlePaymentWebhook(event: string, payment: any) {
    this.logger.log(`======== PROCESSANDO WEBHOOK ========`);
    this.logger.log(`Evento: ${event} | Payment ID: ${payment?.id} | Status: ${payment?.status}`);
    this.logger.log(`Subscription ID: ${payment?.subscription} | Value: ${payment?.value} | Billing: ${payment?.billingType}`);
    this.logger.log(`Due Date: ${payment?.dueDate} | Customer: ${payment?.customer}`);
    this.logger.log(`External Reference: ${payment?.externalReference}`);
    this.logger.log(`=====================================`);

    // Buscar subscription no banco - tentar por subscription ID primeiro, depois por externalReference (userId)
    let subscription: any = null;

    const subscriptionId = payment?.subscription;
    if (subscriptionId) {
      subscription = await this.prisma.subscription.findUnique({
        where: { asaasSubscriptionId: subscriptionId },
        include: { user: true },
      });
    }

    // Fallback: buscar por externalReference (userId) caso subscription ID não bata
    if (!subscription && payment?.externalReference) {
      this.logger.log(`Tentando buscar assinatura por externalReference (userId): ${payment.externalReference}`);
      subscription = await this.prisma.subscription.findUnique({
        where: { userId: payment.externalReference },
        include: { user: true },
      });

      // Atualizar o asaasSubscriptionId se encontrou por fallback e o subscription ID é diferente
      if (subscription && subscriptionId && subscription.asaasSubscriptionId !== subscriptionId) {
        this.logger.log(`Atualizando asaasSubscriptionId de ${subscription.asaasSubscriptionId} para ${subscriptionId}`);
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: { asaasSubscriptionId: subscriptionId },
        });
      }
    }

    if (!subscription) {
      this.logger.warn(`Assinatura não encontrada no banco. Subscription ID: ${subscriptionId}, External Ref: ${payment?.externalReference}`);
      return;
    }

    this.logger.log(`Assinatura encontrada: ${subscription.id} | Plano alvo: ${subscription.plan} | Usuário: ${subscription.userId}`);

    switch (event) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED': {
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'ACTIVE',
            lastPaymentAt: new Date(),
            nextDueDate: payment.dueDate ? new Date(payment.dueDate) : undefined,
          },
        });
        await this.prisma.user.update({
          where: { id: subscription.userId },
          data: {
            plan: subscription.plan,
            planActive: true,
            planExpiresAt: null,
          },
        });
        this.logger.log(`Pagamento confirmado para usuário ${subscription.userId} - plano ${subscription.plan} ativado`);
        break;
      }

      case 'PAYMENT_OVERDUE': {
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'OVERDUE' },
        });
        await this.prisma.user.update({
          where: { id: subscription.userId },
          data: { planActive: false },
        });
        this.logger.warn(`Pagamento vencido - acesso bloqueado para usuário ${subscription.userId}`);
        break;
      }

      case 'PAYMENT_DELETED':
      case 'PAYMENT_REFUNDED': {
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'OVERDUE' },
        });
        await this.prisma.user.update({
          where: { id: subscription.userId },
          data: { planActive: false },
        });
        this.logger.warn(`Pagamento ${event} - acesso bloqueado para usuário ${subscription.userId}`);
        break;
      }

      case 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED': {
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'OVERDUE' },
        });
        await this.prisma.user.update({
          where: { id: subscription.userId },
          data: { planActive: false },
        });
        this.logger.warn(`Cartão recusado - acesso bloqueado para usuário ${subscription.userId}`);
        break;
      }

      default:
        this.logger.log(`Evento ${event} ignorado`);
    }
  }

  // ─── Cron: verificar planos tester expirados ───────────────────────────────

  @Cron(CronExpression.EVERY_HOUR)
  async checkExpiredTesterPlans() {
    const now = new Date();
    const expiredUsers = await this.prisma.user.findMany({
      where: {
        plan: 'TESTER',
        planActive: true,
        planExpiresAt: { lte: now },
      },
    });

    for (const user of expiredUsers) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { planActive: false },
      });
      this.logger.log(`Plano tester expirado para usuário ${user.email}`);
    }

    if (expiredUsers.length > 0) {
      this.logger.log(`${expiredUsers.length} planos tester expirados`);
    }
  }

  // ─── Verificação de limites ────────────────────────────────────────────────

  async checkBotLimit(userId: string): Promise<{ allowed: boolean; message?: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { allowed: false, message: 'Usuário não encontrado' };

    if (!user.planActive) {
      return { allowed: false, message: 'Seu plano ainda não foi ativado. Aguarde a confirmação do pagamento.' };
    }

    const config = PLAN_CONFIGS[user.plan];
    const botCount = await this.prisma.bot.count({ where: { userId } });

    if (botCount >= config.maxBots) {
      return {
        allowed: false,
        message: `Limite de ${config.maxBots} bot(s) atingido no plano ${config.name}. Faça upgrade para criar mais bots.`,
      };
    }
    return { allowed: true };
  }

  async checkDailyMessageLimit(userId: string): Promise<{ allowed: boolean; remaining: number; message?: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { allowed: false, remaining: 0, message: 'Usuário não encontrado' };

    if (!user.planActive) {
      return { allowed: false, remaining: 0, message: 'Seu plano ainda não foi ativado. Aguarde a confirmação do pagamento.' };
    }

    const config = PLAN_CONFIGS[user.plan];
    if (config.maxDailyMessages === -1) {
      return { allowed: true, remaining: -1 };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const messageCount = await this.prisma.message.count({
      where: {
        conversation: { bot: { userId } },
        direction: 'OUTBOUND',
        createdAt: { gte: today },
      },
    });

    const remaining = config.maxDailyMessages - messageCount;
    if (remaining <= 0) {
      return {
        allowed: false,
        remaining: 0,
        message: `Limite de ${config.maxDailyMessages} mensagens diárias atingido no plano ${config.name}.`,
      };
    }

    return { allowed: true, remaining };
  }
}
