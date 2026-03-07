import { IsObject, IsString } from 'class-validator';
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/types';

export class PasskeyChallengeDto {
  @IsString()
  username: string;
}

export class PasskeyVerifyDto {
  @IsString()
  sessionId: string;

  @IsObject()
  assertion: AuthenticationResponseJSON;
}

export class PasskeyRegisterVerifyDto {
  @IsObject()
  attestation: RegistrationResponseJSON;
}
