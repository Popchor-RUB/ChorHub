import { IsObject, IsString } from 'class-validator';

export class PasskeyChallengeDto {
  @IsString()
  username: string;
}

export class PasskeyVerifyDto {
  @IsObject()
  assertion: Record<string, unknown>;
}

export class PasskeyRegisterVerifyDto {
  @IsObject()
  attestation: Record<string, unknown>;
}
