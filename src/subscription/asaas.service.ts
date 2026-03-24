import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

interface CreateCustomerDto {
  name: string;
  email: string;
  cpfCnpj: string;
  externalReference?: string;
}

interface CreditCard {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

interface CreditCardHolderInfo {
  name: string;
  email: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
  phone: string;
}

interface CreateSubscriptionDto {
  customer: string; // Asaas customer ID
  billingType: 'BOLETO' | 'CREDIT_CARD' | 'PIX';
  value: number;
  nextDueDate: string; // YYYY-MM-DD
  cycle: 'MONTHLY';
  description: string;
  externalReference?: string;
  creditCard?: CreditCard;
  creditCardHolderInfo?: CreditCardHolderInfo;
}

@Injectable()
export class AsaasService {
  private readonly logger = new Logger(AsaasService.name);
  private api: AxiosInstance;

  constructor(private config: ConfigService) {
    const baseURL = this.config.get<string>('ASAAS_API_URL', 'https://sandbox.asaas.com/api/v3');
    const apiKey = this.config.get<string>('ASAAS_API_KEY', '');

    this.api = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        access_token: apiKey,
      },
    });
  }

  async createCustomer(data: CreateCustomerDto) {
    this.logger.log(`Criando cliente no Asaas: ${data.email}`);
    try {
      const response = await this.api.post('/customers', {
        name: data.name,
        email: data.email,
        cpfCnpj: data.cpfCnpj,
        externalReference: data.externalReference,
        notificationDisabled: false,
      });
      this.logger.log(`Cliente criado no Asaas: ${response.data.id}`);
      return response.data;
    } catch (err) {
      this.logger.error(`Erro ao criar cliente no Asaas: ${err.response?.data?.errors?.[0]?.description || err.message}`);
      throw err;
    }
  }

  async findCustomerByEmail(email: string) {
    try {
      const response = await this.api.get('/customers', {
        params: { email },
      });
      return response.data?.data?.[0] || null;
    } catch (err) {
      this.logger.error(`Erro ao buscar cliente no Asaas: ${err.message}`);
      return null;
    }
  }

  async createSubscription(data: CreateSubscriptionDto) {
    this.logger.log(`Criando assinatura no Asaas para cliente: ${data.customer}`);
    try {
      const payload: Record<string, any> = {
        customer: data.customer,
        billingType: data.billingType,
        value: data.value,
        nextDueDate: data.nextDueDate,
        cycle: data.cycle,
        description: data.description,
        externalReference: data.externalReference,
      };

      if (data.billingType === 'CREDIT_CARD' && data.creditCard) {
        payload.creditCard = data.creditCard;
        payload.creditCardHolderInfo = data.creditCardHolderInfo;
      }

      const response = await this.api.post('/subscriptions', payload);
      this.logger.log(`Assinatura criada no Asaas: ${response.data.id}`);
      return response.data;
    } catch (err) {
      this.logger.error(`Erro ao criar assinatura no Asaas: ${err.response?.data?.errors?.[0]?.description || err.message}`);
      throw err;
    }
  }

  async getSubscription(subscriptionId: string) {
    try {
      const response = await this.api.get(`/subscriptions/${subscriptionId}`);
      return response.data;
    } catch (err) {
      this.logger.error(`Erro ao buscar assinatura ${subscriptionId}: ${err.message}`);
      throw err;
    }
  }

  async cancelSubscription(subscriptionId: string) {
    this.logger.log(`Cancelando assinatura no Asaas: ${subscriptionId}`);
    try {
      const response = await this.api.delete(`/subscriptions/${subscriptionId}`);
      return response.data;
    } catch (err) {
      this.logger.error(`Erro ao cancelar assinatura: ${err.message}`);
      throw err;
    }
  }

  async getSubscriptionPayments(subscriptionId: string) {
    try {
      const response = await this.api.get(`/subscriptions/${subscriptionId}/payments`);
      return response.data;
    } catch (err) {
      this.logger.error(`Erro ao buscar pagamentos da assinatura: ${err.message}`);
      throw err;
    }
  }

  async getPayment(paymentId: string) {
    try {
      const response = await this.api.get(`/payments/${paymentId}`);
      return response.data;
    } catch (err) {
      this.logger.error(`Erro ao buscar pagamento ${paymentId}: ${err.message}`);
      throw err;
    }
  }

  async getPaymentPixQrCode(paymentId: string) {
    try {
      const response = await this.api.get(`/payments/${paymentId}/pixQrCode`);
      return response.data;
    } catch (err) {
      this.logger.error(`Erro ao buscar QR Code PIX do pagamento ${paymentId}: ${err.message}`);
      throw err;
    }
  }

  async getSubscriptionPaymentsWithRetry(subscriptionId: string, maxRetries = 5, delayMs = 2000): Promise<any> {
    for (let i = 0; i < maxRetries; i++) {
      const payments = await this.getSubscriptionPayments(subscriptionId);
      if (payments?.data?.length > 0) return payments;
      if (i < maxRetries - 1) {
        this.logger.log(`Pagamentos ainda não disponíveis, tentativa ${i + 1}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    return { data: [] };
  }

  async getPaymentPixQrCodeWithRetry(paymentId: string, maxRetries = 5, delayMs = 2000): Promise<any> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await this.getPaymentPixQrCode(paymentId);
      } catch (err) {
        if (i < maxRetries - 1) {
          this.logger.log(`QR Code PIX ainda não disponível, tentativa ${i + 1}/${maxRetries}...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else {
          throw err;
        }
      }
    }
  }

  async getPaymentWithRetry(paymentId: string, maxRetries = 5, delayMs = 2000): Promise<any> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const payment = await this.getPayment(paymentId);
        if (payment?.bankSlipUrl || payment?.identificationField) return payment;
        if (i < maxRetries - 1) {
          this.logger.log(`Dados do boleto ainda não disponíveis, tentativa ${i + 1}/${maxRetries}...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else {
          return payment;
        }
      } catch (err) {
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else {
          throw err;
        }
      }
    }
  }

  async updateSubscription(subscriptionId: string, data: Partial<CreateSubscriptionDto>) {
    try {
      const response = await this.api.put(`/subscriptions/${subscriptionId}`, data);
      return response.data;
    } catch (err) {
      this.logger.error(`Erro ao atualizar assinatura: ${err.message}`);
      throw err;
    }
  }
}
