import { IsString, IsEnum, IsOptional, IsBoolean, IsInt, IsNumber, Min, Max } from 'class-validator';

export enum AiProvider {
  CLAUDE = 'CLAUDE',
  OPENAI = 'OPENAI',
  GEMINI = 'GEMINI',
}

export class CreateAiConfigDto {
  @IsEnum(AiProvider)
  provider: AiProvider;

  @IsString()
  name: string;

  @IsString()
  apiKey: string;

  @IsString()
  model: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(128000)
  maxTokens?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class UpdateAiConfigDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  apiKey?: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(128000)
  maxTokens?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
