import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  UseGuards,
  Req,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateSubscriptionDto } from './dto/subscription.dto';

@Controller('subscription')
export class SubscriptionController {
  private readonly logger = new Logger(SubscriptionController.name);

  constructor(private subscriptionService: SubscriptionService) {}

  @Get('plans')
  getPlans() {
    return this.subscriptionService.getPlans();
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  getUserSubscription(@CurrentUser('id') userId: string) {
    return this.subscriptionService.getUserSubscription(userId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  subscribe(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSubscriptionDto,
  ) {
    return this.subscriptionService.subscribe(
      userId,
      dto.plan,
      dto.billingType || 'PIX',
      dto.cpfCnpj,
      dto.creditCard,
      dto.creditCardHolderInfo,
    );
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  cancelSubscription(@CurrentUser('id') userId: string) {
    return this.subscriptionService.cancelSubscription(userId);
  }

  @Get('message-usage')
  @UseGuards(JwtAuthGuard)
  getMessageUsage(@CurrentUser('id') userId: string) {
    return this.subscriptionService.checkDailyMessageLimit(userId);
  }

  @Get('payments')
  @UseGuards(JwtAuthGuard)
  getPaymentHistory(@CurrentUser('id') userId: string) {
    return this.subscriptionService.getPaymentHistory(userId);
  }

  // ─── Webhook público do Asaas ─────────────────────────────────────────────

  @Post('webhook/asaas')
  @HttpCode(200)
  async handleAsaasWebhook(@Req() req: any) {
    const { event, payment } = req.body;
    this.logger.log(`Webhook Asaas recebido: ${event}`);
    await this.subscriptionService.handlePaymentWebhook(event, payment);
    return { received: true };
  }
}
