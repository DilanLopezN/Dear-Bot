import { IsString, IsDateString, IsOptional } from 'class-validator';

export class CreateScheduledMessageDto {
  @IsString()
  phone: string;

  @IsString()
  @IsOptional()
  contactId?: string;

  @IsString()
  message: string;

  @IsDateString()
  scheduledAt: string;
}
