import { IsString, IsOptional, IsInt, IsBoolean } from 'class-validator';

export class CreateKeywordDto {
  @IsString()
  trigger: string;

  @IsString()
  response: string;

  @IsInt()
  @IsOptional()
  priority?: number;
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
}
