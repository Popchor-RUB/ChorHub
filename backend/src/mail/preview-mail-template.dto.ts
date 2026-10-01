import { IsOptional, IsString } from 'class-validator';
import { UpdateMailTemplateDto } from './update-mail-template.dto';

export class PreviewMailTemplateDto extends UpdateMailTemplateDto {
  @IsOptional()
  @IsString()
  scenarioId?: string;
}
