import { IsString } from 'class-validator';

export class UpdateGeneralInfoDto {
  @IsString()
  markdownContent: string;
}
