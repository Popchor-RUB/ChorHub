import { IsBooleanString, IsOptional, IsString } from 'class-validator';

export class PublishPersonalInfoDto {
  @IsString()
  markdownTemplate: string;

  @IsString()
  emailSubject: string;

  @IsBooleanString()
  sendEmail: string;

  @IsOptional()
  @IsBooleanString()
  deleteNonTargetedEntries?: string;

  @IsString()
  recipientMode: string;

  @IsString()
  placeholderNames: string;
}
