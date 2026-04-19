import { IsString, IsOptional, IsInt, IsBoolean, ValidateNested, IsEnum, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export enum GotoTargetType {
  MENU = 'MENU',
  KEYWORD = 'KEYWORD',
  ITERATION = 'ITERATION',
  LAST_INTERACTION = 'LAST_INTERACTION',
}

export enum VariableTypeDto {
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  DATE = 'DATE',
}

export class GotoTargetDto {
  @IsEnum(GotoTargetType)
  type: GotoTargetType;

  @IsString()
  target: string;
}

export class CaptureVariableDto {
  @IsString()
  name: string;

  @IsEnum(VariableTypeDto)
  type: VariableTypeDto;

  @IsString()
  promptMessage: string;
}

export class CreateKeywordDto {
  @IsString()
  trigger: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  triggers?: string[];

  @IsString()
  response: string;

  @IsInt()
  @IsOptional()
  priority?: number;

  @ValidateNested()
  @Type(() => GotoTargetDto)
  @IsOptional()
  goto?: GotoTargetDto;

  @ValidateNested()
  @Type(() => CaptureVariableDto)
  @IsOptional()
  captureVariable?: CaptureVariableDto;
}

export class UpdateKeywordDto {
  @IsString()
  @IsOptional()
  trigger?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  triggers?: string[];

  @IsString()
  @IsOptional()
  response?: string;

  @IsInt()
  @IsOptional()
  priority?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ValidateNested()
  @Type(() => GotoTargetDto)
  @IsOptional()
  goto?: GotoTargetDto | null;

  @ValidateNested()
  @Type(() => CaptureVariableDto)
  @IsOptional()
  captureVariable?: CaptureVariableDto | null;
}
