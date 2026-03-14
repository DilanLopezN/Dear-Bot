import { IsString, IsOptional, IsEnum } from 'class-validator';

export class CreateWhatsappChannelDto {
  @IsString()
  phoneNumber: string;

  @IsEnum(['DIALOG360', 'EVOLUTION'])
  @IsOptional()
  provider?: 'DIALOG360' | 'EVOLUTION';

  // Dialog360 fields
  @IsString()
  @IsOptional()
  dialog360ApiKey?: string;

  // Evolution API fields
  @IsString()
  @IsOptional()
  evolutionApiUrl?: string;

  @IsString()
  @IsOptional()
  evolutionApiKey?: string;

  @IsString()
  @IsOptional()
  evolutionInstance?: string;

  @IsString()
  @IsOptional()
  webhookSecret?: string;
}

export class UpdateWhatsappChannelDto {
  @IsString()
  @IsOptional()
  dialog360ApiKey?: string;

  @IsString()
  @IsOptional()
  evolutionApiUrl?: string;

  @IsString()
  @IsOptional()
  evolutionApiKey?: string;

  @IsString()
  @IsOptional()
  evolutionInstance?: string;

  @IsString()
  @IsOptional()
  webhookSecret?: string;
}
