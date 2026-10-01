type MailTemplateDefault = {
  key: string;
  subjectTemplate: string;
  htmlTemplate: string;
};

type ReminderStockTemplateWhere = {
  key: 'push-fallback-reminder';
  subjectTemplate: string;
  htmlTemplate: string;
};

type ReminderStockTemplateData = {
  htmlTemplate: string;
};

const HORIZONTAL_SPACER =
  '                  <td width="8" style="width:8px;padding:0;font-size:0;line-height:0;">&nbsp;</td>';
const LEGACY_VERTICAL_SPACER = [
  '                </tr>',
  '                <tr><td height="8" style="height:8px;font-size:0;line-height:0;">&nbsp;</td></tr>',
  '                <tr>',
].join('\n');

/** Upgrade the exact previous stock HTML only, preserving admin and concurrent edits. */
export async function upgradeReminderStockTemplate(
  updateTemplate: (
    where: ReminderStockTemplateWhere,
    data: ReminderStockTemplateData,
  ) => Promise<number>,
  defaults: readonly MailTemplateDefault[],
): Promise<void> {
  const current = defaults.find(({ key }) => key === 'push-fallback-reminder');
  if (!current || !current.htmlTemplate.includes(HORIZONTAL_SPACER)) return;

  await updateTemplate(
    {
      key: 'push-fallback-reminder',
      subjectTemplate: current.subjectTemplate,
      htmlTemplate: current.htmlTemplate.replace(HORIZONTAL_SPACER, LEGACY_VERTICAL_SPACER),
    },
    { htmlTemplate: current.htmlTemplate },
  );
}
