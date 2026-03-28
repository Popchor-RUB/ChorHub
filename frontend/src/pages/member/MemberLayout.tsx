import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  Button,
} from '@heroui/react';
import { MusicalNoteIcon, InformationCircleIcon, Cog6ToothIcon, QrCodeIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { ThemeToggle } from '../../components/ThemeToggle';
import { NotificationBell } from '../../components/NotificationBell';
import { IOSInstallGuide } from '../../components/IOSInstallGuide';
import { useIOSInstallGuide } from '../../hooks/useIOSInstallGuide';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';

export function MemberLayout() {
  const { memberSession, logoutMember } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { visible: showGuide, forced: guideForced, dismiss: dismissGuide } = useIOSInstallGuide('chorhub-ios-guide-member');

  const handleLogout = () => {
    logoutMember();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-default-50">
      {showGuide && <IOSInstallGuide forced={guideForced} onDismiss={dismissGuide} />}
      <Navbar isBordered>
        <NavbarBrand>
          <span className="font-bold text-inherit text-xl">🎵 ChorHub</span>
        </NavbarBrand>
        <NavbarContent className="hidden sm:flex gap-4" justify="center">
          <NavbarItem>
            <NavLink
              to="/proben"
              className={({ isActive }) =>
                isActive ? 'text-primary font-medium' : 'text-default-600'
              }
            >
              {t('nav.rehearsals')}
            </NavLink>
          </NavbarItem>
          <NavbarItem>
            <NavLink
              to="/informationen"
              className={({ isActive }) =>
                isActive ? 'text-primary font-medium' : 'text-default-600'
              }
            >
              {t('nav.information')}
            </NavLink>
          </NavbarItem>
          <NavbarItem>
            <NavLink
              to="/qr-checkin"
              className={({ isActive }) =>
                isActive ? 'text-primary font-medium' : 'text-default-600'
              }
            >
              {t('nav.qr_checkin')}
            </NavLink>
          </NavbarItem>
        </NavbarContent>
        <NavbarContent justify="end">
          <NavbarItem>
            <span className="text-sm text-default-500 hidden sm:block">
              {memberSession?.firstName} {memberSession?.lastName}
            </span>
          </NavbarItem>
          <NavbarItem className="hidden sm:flex">
            <NotificationBell />
          </NavbarItem>
          <NavbarItem className="hidden sm:flex">
            <LanguageSwitcher />
          </NavbarItem>
          <NavbarItem>
            <ThemeToggle />
          </NavbarItem>
          <NavbarItem>
            <Button variant="flat" size="sm" onPress={handleLogout}>
              {t('nav.logout')}
            </Button>
          </NavbarItem>
        </NavbarContent>
      </Navbar>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-divider flex" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <NavLink
          to="/proben"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center py-2 text-center text-xs ${isActive ? 'text-primary font-medium' : 'text-default-500'}`
          }
        >
          <MusicalNoteIcon className="w-6 h-6 mb-0.5" />
          <span>{t('nav.rehearsals')}</span>
        </NavLink>
        <NavLink
          to="/informationen"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center py-2 text-center text-xs ${isActive ? 'text-primary font-medium' : 'text-default-500'}`
          }
        >
          <InformationCircleIcon className="w-6 h-6 mb-0.5" />
          <span>{t('nav.info_short')}</span>
        </NavLink>
        <NavLink
          to="/qr-checkin"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center py-2 text-center text-xs ${isActive ? 'text-primary font-medium' : 'text-default-500'}`
          }
        >
          <QrCodeIcon className="w-6 h-6 mb-0.5" />
          <span>{t('nav.qr_short')}</span>
        </NavLink>
        <NavLink
          to="/einstellungen"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center py-2 text-center text-xs ${isActive ? 'text-primary font-medium' : 'text-default-500'}`
          }
        >
          <Cog6ToothIcon className="w-6 h-6 mb-0.5" />
          <span>{t('nav.settings_short')}</span>
        </NavLink>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-6 mobile-nav-pb">
        <Outlet />
      </main>
    </div>
  );
}
