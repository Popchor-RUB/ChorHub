import { IsBoolean, ValidateIf } from 'class-validator';

export class RetryEmailDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  acknowledgeDuplicateRisk?: boolean;
}
