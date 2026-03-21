import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSubscriptionDto {
  @IsEnum(['PRO', 'ENTERPRISE'])
  @IsNotEmpty()
  plan: 'PRO' | 'ENTERPRISE';

  @IsEnum(['BOLETO', 'CREDIT_CARD', 'PIX'])
  @IsOptional()
  billingType?: 'BOLETO' | 'CREDIT_CARD' | 'PIX' = 'PIX';

  @IsString()
  @IsNotEmpty()
  cpfCnpj: string;
}

export class UpdateSubscriptionDto {
  @IsEnum(['PRO', 'ENTERPRISE'])
  @IsOptional()
  plan?: 'PRO' | 'ENTERPRISE';

  @IsEnum(['BOLETO', 'CREDIT_CARD', 'PIX'])
  @IsOptional()
  billingType?: 'BOLETO' | 'CREDIT_CARD' | 'PIX';
}
