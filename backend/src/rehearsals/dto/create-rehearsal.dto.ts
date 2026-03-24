import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateRehearsalDto {
  @IsDateString()
  date: string;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  durationMinutes?: number;
}
