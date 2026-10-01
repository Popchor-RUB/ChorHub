import type { MailTemplateKey } from './mail-template.types';

export function createMailTemplatePreviewContext(
  key: MailTemplateKey,
  scenarioId: string,
): Record<string, unknown> {
  switch (key) {
    case 'magic-link':
      return {
        firstName: 'Alex',
        magicUrl: 'https://chorhub.example/login?token=preview-token',
        rawToken: 'preview-token',
        loginCode: '123456',
      };
    case 'invite':
      return {
        firstName: 'Alex',
        lastName: 'Muster',
        magicUrl: 'https://chorhub.example/login?token=preview-token',
      };
    case 'push-fallback-reminder':
      return {
        subject: 'ChorHub Erinnerung: Anwesenheit eintragen',
        firstName: 'Alex',
        title: 'Bitte Anwesenheit eintragen',
        intro: 'Bitte gib kurz Bescheid, ob du bei den kommenden Terminen dabei bist.',
        items: [
          {
            label: 'Chorprobe am Dienstag, 18:30 Uhr',
            confirmUrl: scenarioId === 'with-actions' ? 'https://chorhub.example/preview/confirm' : '',
            declineUrl: scenarioId === 'with-actions' ? 'https://chorhub.example/preview/decline' : '',
          },
        ],
        question: scenarioId === 'with-actions' ? 'Bist du dabei?' : '',
        magicUrl: 'https://chorhub.example/login?token=preview-token',
        showGenericLogin: scenarioId !== 'without-actions',
      };
    case 'personal-info':
      return scenarioId === 'bulk'
        ? {
            subject: 'Informationen zum Sommerfest',
            rawSubject: 'Informationen zum Sommerfest',
            firstName: '',
            htmlContent: '<p>Bitte melde dich für das Sommerfest an.</p>',
            htmlSignature: '<p>Viele Grüße<br />Das Chor-Team</p>',
            markdownContent: 'Bitte melde dich für das Sommerfest an.',
            signatureMarkdown: 'Viele Grüße\nDas Chor-Team',
          }
        : {
            subject: 'Deine persönlichen Informationen',
            rawSubject: 'Deine persönlichen Informationen',
            firstName: 'Alex',
            htmlContent: '<p>Deine persönlichen Angaben sind aktuell.</p>',
            htmlSignature: '',
            markdownContent: 'Deine persönlichen Angaben sind aktuell.',
            signatureMarkdown: '',
          };
    case 'member-disabled':
      return {
        firstName: 'Alex',
        adminEmail: 'chor-admin@example.org',
        reason: scenarioId === 'with-reason' ? 'Drei unentschuldigte Fehlzeiten.' : '',
      };
    case 'member-automatically-disabled':
      return { firstName: 'Alex', adminEmail: 'chor-admin@example.org' };
    case 'admin-member-disabled':
      return {
        firstName: 'Alex',
        lastName: 'Muster',
        memberEmail: 'alex@example.org',
        reason: 'Drei unentschuldigte Fehlzeiten.',
      };
  }
}
