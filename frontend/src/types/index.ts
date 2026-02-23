export type ChoirVoice = 'SOPRAN' | 'MEZZOSOPRAN' | 'ALT' | 'TENOR' | 'BARITON' | 'BASS';
export type AttendanceResponse = 'CONFIRMED' | 'DECLINED';

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  choirVoice: ChoirVoice;
  createdAt: string;
}

export interface Rehearsal {
  id: string;
  date: string;
  title: string;
  description: string | null;
  myPlan?: AttendanceResponse | null;
  myAttended?: boolean | null;
}

export interface AttendancePlan {
  id: string;
  memberId: string;
  rehearsalId: string;
  response: AttendanceResponse;
}

export interface MemberOverview extends Member {
  attendanceCount: number;
  unexcusedAbsenceCount: number;
}

export interface MemberRehearsalEntry {
  id: string;
  date: string;
  title: string;
  attended: boolean;
  plan: AttendanceResponse | null;
}

export interface MemberSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  choirVoice: ChoirVoice;
  email: string;
}

export interface MemberHistory {
  id: string;
  firstName: string;
  lastName: string;
  choirVoice: ChoirVoice;
  recentAttendance: { id: string; date: string; title: string }[];
}

export interface AttendanceRecord {
  id: string;
  firstName: string;
  lastName: string;
  choirVoice: ChoirVoice;
  attended: boolean;
  plan: AttendanceResponse | null;
}

export interface VoiceBreakdown {
  [voice: string]: number;
}

export interface RehearsalOverview {
  id: string;
  date: string;
  title: string;
  totalConfirmed?: number;
  totalAttended?: number;
  byVoice: VoiceBreakdown;
}

export interface GeneralInfo {
  id: string;
  markdownContent: string;
  updatedAt: string;
}

export const CHOIR_VOICE_LABELS: Record<ChoirVoice, string> = {
  SOPRAN: 'Sopran',
  MEZZOSOPRAN: 'Mezzosopran',
  ALT: 'Alt',
  TENOR: 'Tenor',
  BARITON: 'Bariton',
  BASS: 'Bass',
};
