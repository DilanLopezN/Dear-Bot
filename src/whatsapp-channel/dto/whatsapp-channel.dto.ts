import { IsString, IsOptional, IsEnum } from 'class-validator';

export class CreateWhatsappChannelDto {
  @IsString()
  phoneNumber: string;

  @IsEnum(['DIALOG360', 'EVOLUTION', 'BAILEYS'])
  @IsOptional()
  provider?: 'DIALOG360' | 'EVOLUTION' | 'BAILEYS';

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

  // Baileys fields
  @IsString()
  @IsOptional()
  baileysSessionId?: string;

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
  baileysSessionId?: string;

  @IsString()
  @IsOptional()
  webhookSecret?: string;
}
