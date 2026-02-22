import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface MemberSession {
  token: string;
  memberId: string;
  firstName: string;
  lastName: string;
  choirVoice: string;
}

interface AdminSession {
  token: string;
  username: string;
}

interface AuthState {
  memberSession: MemberSession | null;
  adminSession: AdminSession | null;
  setMemberSession: (session: MemberSession) => void;
  setAdminSession: (session: AdminSession) => void;
  logoutMember: () => void;
  logoutAdmin: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      memberSession: null,
      adminSession: null,
      setMemberSession: (session) => set({ memberSession: session }),
      setAdminSession: (session) => set({ adminSession: session }),
      logoutMember: () => set({ memberSession: null }),
      logoutAdmin: () => set({ adminSession: null }),
    }),
    { name: 'chorhub-auth' },
  ),
);
