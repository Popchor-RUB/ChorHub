import { Dropdown, Button, Label } from '@heroui/react';
import { ChevronDownIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const informationLinks = [
  { id: 'general', path: '/admin/informationen', labelKey: 'info.member_general_tab' },
  { id: 'personal', path: '/admin/informationen/persoenlich', labelKey: 'info.member_personal_tab' },
  { id: 'push', path: '/admin/benachrichtigungen', labelKey: 'nav.push_notifications' },
  { id: 'email', path: '/admin/informationen/email', labelKey: 'nav.email' },
];

export function InformationMenu({ mobile = false }: { mobile?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isActive = informationLinks.some(({ path }) => pathname === path);

  return (
    <Dropdown>
      <Button
        variant="tertiary"
        size="sm"
        aria-label={t('nav.information')}
        className={mobile
          ? `h-auto min-w-0 flex-1 flex-col gap-0 rounded-none border-0 bg-transparent py-2 text-xs shadow-none data-[hovered=true]:bg-transparent ${isActive ? 'text-accent font-semibold' : 'text-muted'}`
          : `h-auto min-w-0 gap-1 rounded-none border-0 bg-transparent p-0 text-base shadow-none data-[hovered=true]:bg-transparent ${isActive ? 'text-accent font-medium' : 'text-muted hover:text-foreground'}`}
      >
        {mobile && <InformationCircleIcon className="mb-0.5 h-6 w-6" />}
        {t(mobile ? 'nav.info_short' : 'nav.information')}
        {!mobile && <ChevronDownIcon className="h-4 w-4" />}
      </Button>
      <Dropdown.Popover>
        <Dropdown.Menu aria-label={t('nav.information')}>
          {informationLinks.map(({ id, path, labelKey }) => (
            <Dropdown.Item key={id} id={id} textValue={t(labelKey)} onAction={() => navigate(path)}>
              <Label>{t(labelKey)}</Label>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
