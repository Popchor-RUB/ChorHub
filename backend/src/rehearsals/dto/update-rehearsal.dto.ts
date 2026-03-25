import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

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

  @IsString()
  @IsOptional()
  location?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  durationMinutes?: number;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  isOptional?: boolean;
}
