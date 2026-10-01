export type MailTemplateKey =
  | 'magic-link'
  | 'invite'
  | 'push-fallback-reminder'
  | 'personal-info'
  | 'member-disabled'
  | 'member-automatically-disabled'
  | 'admin-member-disabled';

export interface BilingualText {
  de: string;
  en: string;
}

export interface MailTemplatePlaceholder {
  name: string;
  description: BilingualText;
  example: string;
  syntax: string;
  optional?: boolean;
  scope?: string;
}

export interface MailTemplatePreviewScenario {
  id: string;
  name: BilingualText;
  description?: BilingualText;
}

export interface MailTemplateDetail {
  key: MailTemplateKey;
  name: BilingualText;
  description: BilingualText;
  subjectTemplate: string;
  htmlTemplate: string;
  updatedAt: Date;
  placeholders: MailTemplatePlaceholder[];
  previewScenarios: MailTemplatePreviewScenario[];
}

export interface MailTemplateListResponse {
  templates: MailTemplateDetail[];
}

export interface MailTemplatePreviewResponse {
  subject: string;
  html: string;
}
