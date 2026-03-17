import { IsOptional, IsString } from 'class-validator';

export class UploadKnowledgeDto {
  @IsOptional()
  @IsString()
  fileName?: string;
}
