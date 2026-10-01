import { IsString } from 'class-validator';

export class UpdateMailTemplateDto {
  @IsString()
  subjectTemplate!: string;

  @IsString()
  htmlTemplate!: string;
}
