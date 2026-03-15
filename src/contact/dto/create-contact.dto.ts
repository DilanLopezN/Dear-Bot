import { IsString, IsOptional, IsEmail, IsArray } from 'class-validator';

export class CreateContactDto {
  @IsString()
  phone: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsArray()
  @IsOptional()
  tags?: string[];

  @IsOptional()
  customFields?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  notes?: string;
}
