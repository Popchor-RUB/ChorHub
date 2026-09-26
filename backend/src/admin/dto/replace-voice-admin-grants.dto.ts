import { ArrayUnique, IsArray, IsString } from "class-validator";

export class ReplaceVoiceAdminGrantsDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  voiceIds: string[];
}
