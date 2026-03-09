import { IsString, IsOptional } from 'class-validator';

export class CreateWhatsappChannelDto {
  @IsString()
  phoneNumber: string;

  @IsString()
  dialog360ApiKey: string;

  @IsString()
  @IsOptional()
  webhookSecret?: string;
}

export class UpdateWhatsappChannelDto {
  @IsString()
  @IsOptional()
  dialog360ApiKey?: string;

  @IsString()
  @IsOptional()
  webhookSecret?: string;
}
