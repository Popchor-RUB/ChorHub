import { IsOptional, IsString } from 'class-validator';

export class CreateEmailDto {
  @IsString()
  subject!: string;

  @IsString()
  markdownContent!: string;

  @IsOptional()
  @IsString()
  signatureMarkdown?: string;
}
