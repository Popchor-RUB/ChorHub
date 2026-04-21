import { IsString } from 'class-validator';

export class UpdatePersonalInfoEntryDto {
  @IsString()
  markdownContent: string;
}
