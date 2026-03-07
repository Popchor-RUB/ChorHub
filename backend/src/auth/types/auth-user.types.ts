import type { Member } from '../../generated/prisma/client';

export interface AdminUser {
  id: string;
  username: string;
  role: 'admin';
}

export interface MemberUser {
  id: string;
  role: 'member';
  member: Member;
}

export type AuthenticatedUser = AdminUser | MemberUser;
