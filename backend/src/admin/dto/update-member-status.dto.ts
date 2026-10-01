import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMemberStatusDto {
  @IsBoolean()
  disabled: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsBoolean()
  notifyMember?: boolean;

  @IsOptional()
  @IsBoolean()
  includeReasonInEmail?: boolean;
}
