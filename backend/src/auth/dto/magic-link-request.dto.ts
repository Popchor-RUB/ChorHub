import { IsEmail } from 'class-validator';

export class MagicLinkRequestDto {
  @IsEmail()
  email: string;
}
