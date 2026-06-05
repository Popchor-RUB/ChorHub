import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class MemberActivityStatsDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  rehearsalIds: string[];
}
