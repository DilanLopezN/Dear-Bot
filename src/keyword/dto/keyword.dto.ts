import { IsString, IsOptional, IsInt, IsBoolean, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum GotoTargetType {
  MENU = 'MENU',
  KEYWORD = 'KEYWORD',
}

export class GotoTargetDto {
  @IsEnum(GotoTargetType)
  type: GotoTargetType;

  @IsString()
  target: string;
}

export class CreateKeywordDto {
  @IsString()
  trigger: string;

  @IsString()
  response: string;

  @IsInt()
  @IsOptional()
  priority?: number;

  @ValidateNested()
  @Type(() => GotoTargetDto)
  @IsOptional()
  goto?: GotoTargetDto;
}

export class UpdateKeywordDto {
  @IsString()
  @IsOptional()
  trigger?: string;

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
}
