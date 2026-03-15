import { IsString, IsArray, IsOptional } from 'class-validator';

export class CreateBroadcastListDto {
  @IsString()
  name: string;

  @IsArray()
  @IsOptional()
  phones?: string[];
}

export class UpdateBroadcastListDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsArray()
  @IsOptional()
  phones?: string[];
}
