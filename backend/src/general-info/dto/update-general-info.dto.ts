import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateGeneralInfoDto {
  @IsString()
  markdownContent: string;

  @IsBoolean()
  @IsOptional()
  sendPushNotification?: boolean;
}
