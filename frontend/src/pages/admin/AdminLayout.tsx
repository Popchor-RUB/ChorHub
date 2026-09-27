import { Fragment, useCallback } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react';
import {
  UsersIcon,
  MusicalNoteIcon,
  CheckCircleIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { ThemeToggle } from '../../components/ThemeToggle';
import { useIdleTimeout } from '../../hooks/useIdleTimeout';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { InformationMenu } from '../../components/admin/InformationMenu';

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
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-separator bg-background/85 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6" aria-label={t('nav.admin_badge')}>
        <div className="flex items-center gap-2">
          <span className="font-bold text-xl">🎵 ChorHub</span>
          <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-soft-foreground">
            {t('nav.admin_badge')}
          </span>
        </div>
        <ul className="hidden items-center justify-center gap-4 md:flex">
          {navItemDefs.map((item) => (
            <Fragment key={item.to}>
              {item.to === '/admin/einstellungen' && <li><InformationMenu /></li>}
              <li>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    isActive ? 'text-accent font-medium' : 'text-muted hover:text-foreground'
                  }
                >
                  {t(item.labelKey)}
                </NavLink>
              </li>
            </Fragment>
          ))}
        </ul>
        <ul className="flex items-center justify-end gap-1.5">
          <li>
            <span className="text-sm text-muted hidden sm:block">{adminSession?.username}</span>
          </li>
          <li className="hidden sm:flex">
            <LanguageSwitcher />
          </li>
          <li>
            <ThemeToggle />
          </li>
          <li>
            <Button
              className="sm:hidden"
              variant="tertiary"
              size="sm"
              onPress={handleLogout}
              isIconOnly
              aria-label={t('nav.logout')}
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
            </Button>
            <Button className="hidden sm:flex" variant="tertiary" size="sm" onPress={handleLogout}>
              {t('nav.logout')}
            </Button>
          </li>
        </ul>
        </nav>
      </header>

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 flex border-t border-separator bg-background/95 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {navItemDefs.map((item) => (
          <Fragment key={item.to}>
            {item.to === '/admin/einstellungen' && <InformationMenu mobile />}
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center py-2 text-center text-xs ${isActive ? 'text-accent font-semibold' : 'text-muted'}`
              }
            >
              <item.icon className="w-6 h-6 mb-0.5" />
              <span>{t(item.mobileLabelKey)}</span>
            </NavLink>
          </Fragment>
        ))}
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-8">
        <Outlet />
      </main>
    </div>
  );
}
