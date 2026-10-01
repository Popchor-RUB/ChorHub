type MailTemplateDefault = {
  key: string;
  subjectTemplate: string;
  htmlTemplate: string;
};

export type MemberDisabledStockTemplateWhere = {
  key: 'member-disabled';
  subjectTemplate: string;
  htmlTemplate: string;
};

type MemberDisabledStockTemplateData = {
  subjectTemplate: string;
  htmlTemplate: string;
};

export type UpdateMemberDisabledStockTemplate = (
  where: MemberDisabledStockTemplateWhere,
  data: MemberDisabledStockTemplateData,
) => Promise<number>;

const REASON_BLOCK = /\n\s*{{#if reason}}[\s\S]*?{{\/if}}\n/;
const CURRENT_CONTACT_TEXT =
  'Dein Zugang zu ChorHub wurde deaktiviert. Bitte wende dich per E-Mail an das Orga-Team, um deinen Zugang zu klären oder wieder aktivieren zu lassen.';
const PREVIOUS_CONTACT_TEXTS = [
  'Dein Zugang zu ChorHub wurde deaktiviert. Bitte wende dich per E-Mail an die Chor-Admins, um deinen Zugang zu klären oder wieder aktivieren zu lassen.',
  'Dein Zugang zu ChorHub wurde deaktiviert. Bitte wende dich per E-Mail an das Orga-Team, um deinen Zugang zu klären oder wieder aktivieren zu lassen.',
];

/** Upgrade only exact packaged stock versions; custom member templates remain untouched. */
export async function upgradeMemberDisabledStockTemplate(
  updateTemplate: UpdateMemberDisabledStockTemplate,
  defaults: readonly MailTemplateDefault[],
): Promise<void> {
  const current = defaults.find(({ key }) => key === 'member-disabled');
  if (!current) return;

  const withoutReason = current.htmlTemplate.replace(REASON_BLOCK, '\n');
  if (withoutReason === current.htmlTemplate) return;

  const previousParagraph = `<p style="margin:0 0 16px;">${CURRENT_CONTACT_TEXT}</p>`;
  if (!withoutReason.includes(previousParagraph)) return;

  for (const contactText of PREVIOUS_CONTACT_TEXTS) {
    const previousHtml = withoutReason.replace(
      previousParagraph,
      `<p style="margin:0 0 16px;">${contactText}</p>`,
    );
    await updateTemplate(
      {
        key: 'member-disabled',
        subjectTemplate: current.subjectTemplate,
        htmlTemplate: previousHtml,
      },
      {
        subjectTemplate: current.subjectTemplate,
        htmlTemplate: current.htmlTemplate,
      },
    );
  }
}
