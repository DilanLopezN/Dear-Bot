import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class MenuOptionDto {
  @IsString()
  id: string;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;
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

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
