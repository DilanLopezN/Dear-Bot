import { Module } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { AsaasService } from './asaas.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SubscriptionController],
  providers: [SubscriptionService, AsaasService],
  exports: [SubscriptionService, AsaasService],
})
export class SubscriptionModule {}
