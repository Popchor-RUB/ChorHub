import { useCallback } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  Button,
} from '@heroui/react';
import {
  UsersIcon,
  MusicalNoteIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  BellIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { ThemeToggle } from '../../components/ThemeToggle';
import { useIdleTimeout } from '../../hooks/useIdleTimeout';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

type NavItemDef = {
  to: string;
  labelKey: string;
  mobileLabelKey: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const navItemDefs: NavItemDef[] = [
  { to: '/admin/mitglieder', labelKey: 'nav.members', mobileLabelKey: 'nav.members', icon: UsersIcon },
  { to: '/admin/proben', labelKey: 'nav.rehearsals', mobileLabelKey: 'nav.rehearsals', icon: MusicalNoteIcon },
  { to: '/admin/anwesenheit', labelKey: 'nav.attendance', mobileLabelKey: 'nav.attendance', icon: CheckCircleIcon },
  { to: '/admin/informationen', labelKey: 'nav.information', mobileLabelKey: 'nav.info_short', icon: InformationCircleIcon },
  { to: '/admin/benachrichtigungen', labelKey: 'nav.notifications', mobileLabelKey: 'nav.notifications_short', icon: BellIcon },
  { to: '/admin/einstellungen', labelKey: 'nav.settings', mobileLabelKey: 'nav.settings_short', icon: Cog6ToothIcon },
];

export function AdminLayout() {
  const { adminSession, logoutAdmin } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleLogout = () => {
    logoutAdmin();
    navigate('/admin/login');
  };

  const handleIdleLogout = useCallback(() => {
    logoutAdmin();
    navigate('/admin/login');
  }, [logoutAdmin, navigate]);

  useIdleTimeout(handleIdleLogout, IDLE_TIMEOUT_MS);

  return (
    <div className="min-h-screen bg-default-50">
      <Navbar isBordered>
        <NavbarBrand>
          <span className="font-bold text-xl">🎵 ChorHub</span>
          <span className="ml-2 text-xs bg-warning-100 text-warning-700 px-2 py-0.5 rounded-full">
            {t('nav.admin_badge')}
          </span>
        </NavbarBrand>
        <NavbarContent className="hidden md:flex gap-4" justify="center">
          {navItemDefs.map((item) => (
            <NavbarItem key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  isActive ? 'text-primary font-medium' : 'text-default-600 hover:text-default-900'
                }
              >
                {t(item.labelKey)}
              </NavLink>
            </NavbarItem>
          ))}
        </NavbarContent>
        <NavbarContent justify="end">
          <NavbarItem>
            <span className="text-sm text-default-500 hidden sm:block">{adminSession?.username}</span>
          </NavbarItem>
          <NavbarItem className="hidden sm:flex">
            <LanguageSwitcher />
          </NavbarItem>
          <NavbarItem>
            <ThemeToggle />
          </NavbarItem>
          <NavbarItem>
            <Button
              className="sm:hidden"
              variant="flat"
              size="sm"
              onPress={handleLogout}
              isIconOnly
              aria-label={t('nav.logout')}
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
            </Button>
            <Button className="hidden sm:flex" variant="flat" size="sm" onPress={handleLogout}>
              {t('nav.logout')}
            </Button>
          </NavbarItem>
        </NavbarContent>
      </Navbar>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-divider flex z-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {navItemDefs.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2 text-center text-xs ${isActive ? 'text-primary font-semibold' : 'text-default-500'}`
            }
          >
            <item.icon className="w-6 h-6 mb-0.5" />
            <span>{t(item.mobileLabelKey)}</span>
          </NavLink>
        ))}
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-8">
        <Outlet />
      </main>
    </div>
  );
}
