export type AttendanceResponse = 'CONFIRMED' | 'DECLINED';

export interface ChoirVoice {
  id: string;
  name: string;
  sortOrder: number;
  memberCount?: number;
}

export type MailTemplateKey =
  | 'magic-link'
  | 'invite'
  | 'push-fallback-reminder'
  | 'personal-info'
  | 'member-disabled'
  | 'member-automatically-disabled'
  | 'admin-member-disabled';

export interface LocalizedText {
  de: string;
  en: string;
}

export interface MailTemplatePlaceholder {
  name: string;
  description: LocalizedText;
  example: string;
  syntax: string;
  optional?: boolean;
  scope?: string;
}

export interface MailTemplatePreviewScenario {
  id: string;
  name: LocalizedText;
  description?: LocalizedText;
}

export interface MailTemplate {
  key: MailTemplateKey;
  name: LocalizedText;
  description: LocalizedText;
  subjectTemplate: string;
  htmlTemplate: string;
  updatedAt: string | null;
  placeholders: MailTemplatePlaceholder[];
  previewScenarios: MailTemplatePreviewScenario[];
}

export interface MailTemplatePreview {
  subject: string;
  html: string;
}

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  choirVoice: ChoirVoice | null;
  createdAt: string;
  isDisabled: boolean;
  disabledAt: string | null;
  disableReason: string | null;
}

export interface Rehearsal {
  id: string;
  date: string;
  title: string;
  description: string | null;
  location: string | null;
  durationMinutes: number | null;
  isOptional: boolean;
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
  internalComment: string | null;
}

export interface MemberActivityRehearsal {
  id: string;
  date: string;
  title: string;
}

export interface MemberActivityVoiceStats {
  voiceId: string | null;
  voiceName: string | null;
  totalMembers: number;
  activeMembers: number;
  activeRate: number;
}

export interface MemberActivityStats {
  selectedRehearsals: MemberActivityRehearsal[];
  memberCountTotal: number;
  activeMemberCount: number;
  activeRate: number;
  totalAttendances: number;
  averageAttendancePerRehearsal: number;
  inactiveMemberCount: number;
  byVoice: MemberActivityVoiceStats[];
}

export interface VoiceAdminVoice {
  id: string;
  name: string;
}

export interface AdminMemberDetail extends MemberOverview {
  voiceAdminVoices: VoiceAdminVoice[];
}

export interface VoiceAttendanceRecord {
  id: string;
  firstName: string;
  lastName: string;
  choirVoice: ChoirVoice | null;
  attended: boolean;
  plan: AttendanceResponse | null;
  lastAttendedRehearsalsAgo: number | null;
  internalComment: string | null;
}

export interface MemberProfile extends Member {
  voiceAdminVoices: VoiceAdminVoice[];
}

export interface MemberRehearsalEntry {
  id: string;
  date: string;
  title: string;
  isOptional: boolean;
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
  email: string;
  internalComment: string | null;
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
  durationMinutes?: number | null;
  isOptional?: boolean;
  totalConfirmed?: number;
  totalAttended?: number;
  byVoice: VoiceBreakdown;
}

export interface AdminRehearsalListOverview {
  future: RehearsalOverview[];
  past: RehearsalOverview[];
}

export interface GeneralInfo {
  id: string;
  markdownContent: string;
  updatedAt: string;
}

export interface AppSetting {
  key: string;
  value: string | null;
}

export interface PersonalInfo {
  id: string | null;
  memberId: string | null;
  markdownContent: string;
  updatedAt: string | null;
}

export interface SentEmailAttachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
}

export interface SentEmail {
  id: string;
  subject: string;
  rawSubject: string;
  markdownContent: string;
  signatureMarkdown: string;
  sentAt: string;
  attachments: SentEmailAttachment[];
}

export type AdminEmailJobKind = 'BULK' | 'TEST';
export type AdminEmailJobStatus = 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | 'UNKNOWN';

export interface AdminEmailJobAcceptance {
  id: string;
  kind: AdminEmailJobKind;
  status: AdminEmailJobStatus;
  createdAt: string;
}

export interface AdminEmailJob extends AdminEmailJobAcceptance {
  idempotencyKey: string | null;
  sentAt: string | null;
  rawSubject: string;
  subject: string;
  markdownContent: string;
  signatureMarkdown: string;
  attachments: SentEmailAttachment[];
  failureCode: string | null;
  retryJobId: string | null;
}

export interface PersonalInfoConfig {
  id: string;
  markdownTemplate: string;
  emailSubject: string;
  updatedAt: string;
}

export interface PersonalInfoMemberRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  hasPersonalInfo: boolean;
  updatedAt: string | null;
}

export type PersonalInfoSendStatusState = 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface PersonalInfoSendStatus {
  status: PersonalInfoSendStatusState;
  total: number;
  sent: number;
  failed: number;
  remaining: number;
  startedAt: string | null;
  finishedAt: string | null;
  lastError: string | null;
}

export interface CheckinPayload {
  memberId: string;
  name: string;
  issuedAt: string;
  version: 'v1';
}

export interface MemberCheckinQr {
  token: string;
  qrCodeDataUrl: string;
}
