export type AttendanceResponse = 'CONFIRMED' | 'DECLINED';

export interface ChoirVoice {
  id: string;
  name: string;
  sortOrder: number;
  memberCount?: number;
}

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  choirVoice: ChoirVoice | null;
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
  choirVoice: ChoirVoice | null;
  email: string;
}

export interface MemberHistory {
  id: string;
  firstName: string;
  lastName: string;
  choirVoice: ChoirVoice | null;
  recentAttendance: { id: string; date: string; title: string }[];
}

export interface AttendanceRecord {
  id: string;
  firstName: string;
  lastName: string;
  choirVoice: ChoirVoice | null;
  attended: boolean;
  plan: AttendanceResponse | null;
  lastAttendedRehearsalsAgo: number | null;
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
