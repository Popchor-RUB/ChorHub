import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateRehearsalDto {
  @IsDateString()
  date: string;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;
}
