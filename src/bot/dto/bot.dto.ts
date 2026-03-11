import { IsString, IsEnum, IsOptional, IsBoolean, IsObject, ValidateIf } from 'class-validator';

export enum BotResponseMode {
  KEYWORDS = 'KEYWORDS',
  AI = 'AI',
  HYBRID = 'HYBRID',
}

export class CreateBotDto {
  @IsString()
  name: string;

  @IsEnum(BotResponseMode)
  @IsOptional()
  responseMode?: BotResponseMode;

  @IsString()
  @IsOptional()
  initialMessage?: string;

  @IsString()
  @IsOptional()
  systemPrompt?: string;

  @IsString()
  @IsOptional()
  aiConfigId?: string;

  @IsObject()
  @IsOptional()
  flowConfig?: Record<string, any>;
}

export class UpdateBotDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(BotResponseMode)
  @IsOptional()
  responseMode?: BotResponseMode;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  initialMessage?: string;

  @IsString()
  @IsOptional()
  systemPrompt?: string;

  @ValidateIf((_obj, value) => value !== null)
  @IsString()
  @IsOptional()
  aiConfigId?: string | null;

  @ValidateIf((_obj, value) => value !== null)
  @IsObject()
  @IsOptional()
  flowConfig?: Record<string, any> | null;
}
