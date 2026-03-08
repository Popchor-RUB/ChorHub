import { IsEmail, IsString, Matches } from 'class-validator';

export class VerifyCodeDto {
  @IsEmail()
  email: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'Code muss aus genau 6 Ziffern bestehen' })
  code: string;
}
