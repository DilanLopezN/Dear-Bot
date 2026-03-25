import { IsString, IsOptional, IsBoolean, IsEnum, IsNumber } from 'class-validator';
import { SubscriptionPlan } from '@prisma/client';

export class AdminLoginDto {
  @IsString()
  password: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsEnum(SubscriptionPlan)
  plan?: SubscriptionPlan;

  @IsOptional()
  @IsBoolean()
  planActive?: boolean;

  @IsOptional()
  @IsString()
  cpfCnpj?: string;
}

export class UpdateUserPlanDto {
  @IsEnum(SubscriptionPlan)
  plan: SubscriptionPlan;

  @IsBoolean()
  planActive: boolean;

  @IsOptional()
  @IsNumber()
  planDays?: number;
}
