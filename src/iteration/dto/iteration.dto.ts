import { IsString, IsOptional, IsInt, IsBoolean, IsEnum, IsObject } from 'class-validator';

export enum IterationTypeDto {
  TEXT = 'TEXT',
  LINK = 'LINK',
  DOCUMENT = 'DOCUMENT',
  GOTO = 'GOTO',
  CAPTURE_VARIABLE = 'CAPTURE_VARIABLE',
  CLOSE_CONVERSATION = 'CLOSE_CONVERSATION',
  AI = 'AI',
}

export enum IterationModeDto {
  FLUXO = 'FLUXO',
  CHAMADA = 'CHAMADA',
}

export class CreateIterationDto {
  @IsString()
  name: string;

  @IsEnum(IterationTypeDto)
  type: IterationTypeDto;

  @IsEnum(IterationModeDto)
  @IsOptional()
  mode?: IterationModeDto;

  @IsObject()
  content: Record<string, any>;

  @IsInt()
  @IsOptional()
  order?: number;
}

export class UpdateIterationDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(IterationTypeDto)
  @IsOptional()
  type?: IterationTypeDto;

  @IsEnum(IterationModeDto)
  @IsOptional()
  mode?: IterationModeDto;

  @IsObject()
  @IsOptional()
  content?: Record<string, any>;

  @IsInt()
  @IsOptional()
  order?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
