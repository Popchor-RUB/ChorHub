import { Cog6ToothIcon } from '@heroicons/react/24/outline';
import { AdminNavigationMenu } from './AdminNavigationMenu';

const settingsLinks = [
  { id: 'voices', path: '/admin/einstellungen', labelKey: 'voice.section_title' },
  { id: 'cloud', path: '/admin/einstellungen/cloud', labelKey: 'cloud.admin_menu' },
  { id: 'mail-templates', path: '/admin/einstellungen/email-templates', labelKey: 'nav.mail_templates' },
];

export function SettingsMenu({ mobile = false }: { mobile?: boolean }) {
  return (
    <AdminNavigationMenu
      mobile={mobile}
      labelKey="nav.settings"
      mobileLabelKey="nav.settings_short"
      icon={Cog6ToothIcon}
      links={settingsLinks}
    />
  );
}
