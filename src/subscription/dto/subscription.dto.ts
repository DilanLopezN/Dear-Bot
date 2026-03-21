import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreditCardDto {
  @IsString()
  @IsNotEmpty()
  holderName: string;

  @IsString()
  @IsNotEmpty()
  number: string;

  @IsString()
  @IsNotEmpty()
  expiryMonth: string;

  @IsString()
  @IsNotEmpty()
  expiryYear: string;

  @IsString()
  @IsNotEmpty()
  ccv: string;
}

export class CreditCardHolderInfoDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  cpfCnpj: string;

  @IsString()
  @IsNotEmpty()
  postalCode: string;

  @IsString()
  @IsNotEmpty()
  addressNumber: string;

  @IsString()
  @IsNotEmpty()
  phone: string;
}

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

  @IsOptional()
  @ValidateNested()
  @Type(() => CreditCardDto)
  creditCard?: CreditCardDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreditCardHolderInfoDto)
  creditCardHolderInfo?: CreditCardHolderInfoDto;
}

export class UpdateSubscriptionDto {
  @IsEnum(['PRO', 'ENTERPRISE'])
  @IsOptional()
  plan?: 'PRO' | 'ENTERPRISE';

  @IsEnum(['BOLETO', 'CREDIT_CARD', 'PIX'])
  @IsOptional()
  billingType?: 'BOLETO' | 'CREDIT_CARD' | 'PIX';
}
