import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateRehearsalDto {
  @IsDateString()
  @IsOptional()
  date?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
