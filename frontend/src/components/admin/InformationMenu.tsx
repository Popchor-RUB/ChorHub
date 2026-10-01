import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { AdminNavigationMenu } from './AdminNavigationMenu';

const informationLinks = [
  { id: 'general', path: '/admin/informationen', labelKey: 'info.member_general_tab' },
  { id: 'personal', path: '/admin/informationen/persoenlich', labelKey: 'info.member_personal_tab' },
  { id: 'push', path: '/admin/benachrichtigungen', labelKey: 'nav.push_notifications' },
  { id: 'email', path: '/admin/informationen/email', labelKey: 'nav.email' },
];

export function InformationMenu({ mobile = false }: { mobile?: boolean }) {
  return (
    <AdminNavigationMenu
      mobile={mobile}
      labelKey="nav.information"
      mobileLabelKey="nav.info_short"
      icon={InformationCircleIcon}
      links={informationLinks}
    />
  );
}
