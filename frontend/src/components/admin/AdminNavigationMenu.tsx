import { Dropdown, Button, Label } from '@heroui/react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

type AdminNavigationMenuProps = {
  mobile?: boolean;
  labelKey: string;
  mobileLabelKey: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  links: readonly { id: string; path: string; labelKey: string }[];
};

export function AdminNavigationMenu({
  mobile = false,
  labelKey,
  mobileLabelKey,
  icon: Icon,
  links,
}: AdminNavigationMenuProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isActive = links.some(({ path }) => pathname === path);

  return (
    <Dropdown>
      <Button
        variant="tertiary"
        size="sm"
        aria-label={t(labelKey)}
        className={mobile
          ? `h-auto min-w-0 flex-1 flex-col gap-0 rounded-none border-0 bg-transparent py-2 text-xs shadow-none data-[hovered=true]:bg-transparent ${isActive ? 'text-accent font-semibold' : 'text-muted'}`
          : `h-auto min-w-0 gap-1 rounded-none border-0 bg-transparent p-0 text-base shadow-none data-[hovered=true]:bg-transparent ${isActive ? 'text-accent font-medium' : 'text-muted hover:text-foreground'}`}
      >
        {mobile && <Icon className="mb-0.5 h-6 w-6" />}
        {t(mobile ? mobileLabelKey : labelKey)}
        {!mobile && <ChevronDownIcon className="h-4 w-4" />}
      </Button>
      <Dropdown.Popover>
        <Dropdown.Menu aria-label={t(labelKey)}>
          {links.map(({ id, path, labelKey }) => (
            <Dropdown.Item key={id} id={id} textValue={t(labelKey)} onAction={() => navigate(path)}>
              <Label>{t(labelKey)}</Label>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
