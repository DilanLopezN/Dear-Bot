import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
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

export class MenuOptionDto {
  @IsString()
  id: string;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @ValidateNested()
  @Type(() => GotoTargetDto)
  @IsOptional()
  goto?: GotoTargetDto;
}

export class CreateMenuDto {
  @IsString()
  trigger: string;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsString()
  @IsOptional()
  footer?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuOptionDto)
  options: MenuOptionDto[];

  @ValidateNested()
  @Type(() => CaptureVariableDto)
  @IsOptional()
  captureVariable?: CaptureVariableDto;
}

export class UpdateMenuDto {
  @IsString()
  @IsOptional()
  trigger?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsString()
  @IsOptional()
  footer?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => MenuOptionDto)
  options?: MenuOptionDto[];

  @ValidateNested()
  @Type(() => CaptureVariableDto)
  @IsOptional()
  captureVariable?: CaptureVariableDto | null;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
