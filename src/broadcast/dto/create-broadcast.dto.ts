import { IsString, IsArray, IsOptional, IsDateString } from 'class-validator';

export class CreateBroadcastDto {
  @IsString()
  name: string;

  @IsString()
  message: string;

  @IsString()
  @IsOptional()
  listId?: string;

  @IsArray()
  @IsOptional()
  phones?: string[];

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;
}
