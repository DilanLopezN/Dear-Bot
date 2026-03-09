import { IsString, IsEnum, IsOptional, IsBoolean } from 'class-validator';

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
  systemPrompt?: string;
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
  systemPrompt?: string;
}
