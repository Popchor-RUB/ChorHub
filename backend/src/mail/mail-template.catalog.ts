import type {
  BilingualText,
  MailTemplateKey,
  MailTemplatePlaceholder,
  MailTemplatePreviewScenario,
} from './mail-template.types';

export interface MailTemplateDefinition {
  key: MailTemplateKey;
  name: BilingualText;
  description: BilingualText;
  subjectTemplate: string;
  placeholders: MailTemplatePlaceholder[];
  previewScenarios: MailTemplatePreviewScenario[];
}

const placeholder = (
  name: string,
  description: BilingualText,
  example: string,
  options: Pick<MailTemplatePlaceholder, 'optional' | 'scope'> = {},
): MailTemplatePlaceholder => ({ name, description, example, syntax: `{{${name}}}`, ...options });

const scenario = (id: string, de: string, en: string): MailTemplatePreviewScenario => ({
  id,
  name: { de, en },
});

export const MAIL_TEMPLATE_DEFINITIONS: MailTemplateDefinition[] = [
  {
    key: 'magic-link',
    name: { de: 'Anmeldelink', en: 'Sign-in link' },
    description: {
      de: 'Anmeldung mit dauerhaftem Link und Einmalcode.',
      en: 'Sign in with a persistent link and one-time code.',
    },
    subjectTemplate: 'Dein ChorHub Anmeldelink',
    placeholders: [
      placeholder('firstName', { de: 'Vorname des Mitglieds.', en: 'Member first name.' }, 'Alex'),
      placeholder('magicUrl', { de: 'Persönlicher Anmeldelink.', en: 'Personal sign-in link.' }, 'https://chorhub.example/login?token=abc'),
      placeholder('rawToken', { de: 'Roher Zugangstoken.', en: 'Raw access token.' }, 'example-token'),
      placeholder('loginCode', { de: 'Sechsstelliger Einmalcode.', en: 'Six-digit one-time code.' }, '123456'),
    ],
    previewScenarios: [scenario('standard', 'Standard', 'Standard')],
  },
  {
    key: 'invite',
    name: { de: 'Einladung', en: 'Invitation' },
    description: { de: 'Einladung eines neuen Mitglieds zu ChorHub.', en: 'Invite a new member to ChorHub.' },
    subjectTemplate: 'Willkommen bei ChorHub – Dein Zugangslink',
    placeholders: [
      placeholder('firstName', { de: 'Vorname des Mitglieds.', en: 'Member first name.' }, 'Alex'),
      placeholder('lastName', { de: 'Nachname des Mitglieds.', en: 'Member last name.' }, 'Muster'),
      placeholder('magicUrl', { de: 'Persönlicher Anmeldelink.', en: 'Personal sign-in link.' }, 'https://chorhub.example/login?token=abc'),
    ],
    previewScenarios: [scenario('standard', 'Standard', 'Standard')],
  },
  {
    key: 'push-fallback-reminder',
    name: { de: 'Erinnerung per E-Mail', en: 'Email reminder' },
    description: { de: 'E-Mail-Erinnerung mit Proben und Aktivitäten.', en: 'Email reminder with rehearsals and activities.' },
    subjectTemplate: '{{subject}}',
    placeholders: [
      placeholder('subject', { de: 'Betreff aus der Erinnerung.', en: 'Reminder subject.' }, 'ChorHub Erinnerung: Anwesenheit eintragen'),
      placeholder('firstName', { de: 'Vorname des Mitglieds.', en: 'Member first name.' }, 'Alex'),
      placeholder('title', { de: 'Titel der Erinnerung.', en: 'Reminder title.' }, 'Bitte Anwesenheit eintragen'),
      placeholder('intro', { de: 'Einleitung der Erinnerung.', en: 'Reminder introduction.' }, 'Bitte gib kurz Bescheid.'),
      placeholder('items', { de: 'Liste der Termine.', en: 'List of events.' }, 'Termine'),
      placeholder('label', { de: 'Terminname innerhalb von items.', en: 'Event label inside items.' }, 'Chorprobe am Dienstag', { scope: 'each items' }),
      { ...placeholder('this.label', { de: 'Terminname über this innerhalb von items.', en: 'Event label through this inside items.' }, 'Chorprobe am Dienstag', { scope: 'each items' }), syntax: '{{this.label}}' },
      placeholder('confirmUrl', { de: 'Link zum Zusagen.', en: 'Confirmation link.' }, 'https://chorhub.example/confirm', { optional: true, scope: 'each items' }),
      placeholder('declineUrl', { de: 'Link zum Absagen.', en: 'Decline link.' }, 'https://chorhub.example/decline', { optional: true, scope: 'each items' }),
      { ...placeholder('@index', { de: 'Nullbasierter Terminindex.', en: 'Zero-based event index.' }, '0', { scope: 'each items' }), syntax: '{{@index}}' },
      { ...placeholder('@first', { de: 'Wahr, wenn Termin erster Eintrag ist.', en: 'True when event is first item.' }, 'true', { scope: 'each items' }), syntax: '{{@first}}' },
      { ...placeholder('@last', { de: 'Wahr, wenn Termin letzter Eintrag ist.', en: 'True when event is last item.' }, 'true', { scope: 'each items' }), syntax: '{{@last}}' },
      placeholder('question', { de: 'Optionale Rückfrage.', en: 'Optional question.' }, 'Bist du dabei?', { optional: true }),
      placeholder('showGenericLogin', { de: 'Zeigt allgemeinen Anmeldelink.', en: 'Shows generic sign-in link.' }, 'true'),
      placeholder('magicUrl', { de: 'Persönlicher Anmeldelink.', en: 'Personal sign-in link.' }, 'https://chorhub.example/login?token=abc', { optional: true }),
    ],
    previewScenarios: [
      scenario('with-actions', 'Mit Zusage und Absage', 'With confirm and decline actions'),
      scenario('without-actions', 'Ohne Aktionen', 'Without actions'),
      scenario('generic-login', 'Mit allgemeinem Anmeldelink', 'With generic sign-in link'),
    ],
  },
  {
    key: 'personal-info',
    name: { de: 'Persönliche Information', en: 'Personal information' },
    description: { de: 'Persönliche und gemeinsame Informationsmail.', en: 'Personal and bulk information email.' },
    subjectTemplate: '{{subject}}',
    placeholders: [
      placeholder('subject', { de: 'Betreff für Nachricht und Mail.', en: 'Message and email subject.' }, 'Informationen zum Sommerfest'),
      placeholder('rawSubject', { de: 'Unpräfixter Betreff aus dem Versandformular.', en: 'Unprefixed subject from the send form.' }, 'Informationen zum Sommerfest'),
      placeholder('firstName', { de: 'Vorname, bei Sammelmail leer.', en: 'First name, empty for bulk mail.' }, 'Alex', { optional: true }),
      { ...placeholder('htmlContent', { de: 'Sicher gerendertes HTML des Markdown-Inhalts.', en: 'Safely rendered Markdown content as HTML.' }, '<p>Bitte melde dich an.</p>'), syntax: '{{{htmlContent}}}' },
      { ...placeholder('htmlSignature', { de: 'Sicher gerendertes HTML der Signatur.', en: 'Safely rendered signature HTML.' }, '<p>Viele Grüße</p>', { optional: true }), syntax: '{{{htmlSignature}}}' },
      placeholder('markdownContent', { de: 'Markdown-Inhalt der Nachricht.', en: 'Message body in Markdown.' }, 'Bitte melde dich an.'),
      placeholder('signatureMarkdown', { de: 'Signatur in Markdown.', en: 'Signature in Markdown.' }, 'Viele Grüße', { optional: true }),
    ],
    previewScenarios: [
      scenario('personal', 'Persönliche Nachricht', 'Personal message'),
      scenario('bulk', 'Sammelmail mit Signatur', 'Bulk email with signature'),
    ],
  },
  {
    key: 'member-disabled',
    name: { de: 'Zugang deaktiviert', en: 'Account disabled' },
    description: { de: 'Hinweis an ein Mitglied über einen deaktivierten Zugang.', en: 'Notify a member that their account was disabled.' },
    subjectTemplate: 'Dein ChorHub Zugang wurde deaktiviert',
    placeholders: [
      placeholder('firstName', { de: 'Vorname des Mitglieds.', en: 'Member first name.' }, 'Alex'),
      placeholder('adminEmail', { de: 'Kontaktadresse der Chor-Admins.', en: 'Choir admin contact address.' }, 'chor-admin@example.org'),
    ],
    previewScenarios: [scenario('standard', 'Standard', 'Standard')],
  },
  {
    key: 'admin-member-disabled',
    name: { de: 'Admin-Hinweis: Zugang deaktiviert', en: 'Admin notice: account disabled' },
    description: { de: 'Interne Benachrichtigung der Chor-Admins.', en: 'Internal notification to choir admins.' },
    subjectTemplate: 'ChorHub Mitglied deaktiviert: {{firstName}} {{lastName}}',
    placeholders: [
      placeholder('firstName', { de: 'Vorname des Mitglieds.', en: 'Member first name.' }, 'Alex'),
      placeholder('lastName', { de: 'Nachname des Mitglieds.', en: 'Member last name.' }, 'Muster'),
      placeholder('memberEmail', { de: 'E-Mail-Adresse des Mitglieds.', en: 'Member email address.' }, 'alex@example.org'),
      placeholder('reason', { de: 'Grund der Deaktivierung.', en: 'Reason for disabling the account.' }, 'Drei unentschuldigte Fehlzeiten.', { optional: true }),
    ],
    previewScenarios: [scenario('standard', 'Mit Deaktivierungsgrund', 'With disable reason')],
  },
];

export const MAIL_TEMPLATE_BY_KEY = new Map(
  MAIL_TEMPLATE_DEFINITIONS.map((definition) => [definition.key, definition]),
);
