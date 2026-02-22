import { ChoirVoice } from '@prisma/client';

export class MemberResponseDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  choirVoice: ChoirVoice;
  createdAt: Date;
}
