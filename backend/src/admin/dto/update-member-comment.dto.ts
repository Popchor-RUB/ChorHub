import { IsString, MaxLength } from 'class-validator';

export class UpdateMemberCommentDto {
  @IsString()
  @MaxLength(2000)
  comment: string;
}
