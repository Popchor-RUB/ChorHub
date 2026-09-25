import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react';
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
    <div className="min-h-screen">
      {showGuide && <IOSInstallGuide forced={guideForced} onDismiss={dismissGuide} />}
      <header className="sticky top-0 z-40 border-b border-separator bg-background/85 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6" aria-label="ChorHub">
        <div className="flex items-center gap-2">
          <span className="font-bold text-inherit text-xl">🎵 ChorHub</span>
        </div>
        <ul className="hidden items-center justify-center gap-4 sm:flex">
          <li>
            <NavLink
              to="/proben"
              className={({ isActive }) =>
                isActive ? 'text-accent font-medium' : 'text-muted'
              }
            >
              {t('nav.rehearsals')}
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/informationen"
              className={({ isActive }) =>
                isActive ? 'text-accent font-medium' : 'text-muted'
              }
            >
              {t('nav.information')}
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/qr-checkin"
              className={({ isActive }) =>
                isActive ? 'text-accent font-medium' : 'text-muted'
              }
            >
              {t('nav.qr_checkin')}
            </NavLink>
          </li>
        </ul>
        <ul className="flex items-center justify-end gap-1.5">
          <li>
            <span className="text-sm text-muted hidden sm:block">
              {memberSession?.firstName} {memberSession?.lastName}
            </span>
          </li>
          <li className="hidden sm:flex">
            <NotificationBell />
          </li>
          <li className="hidden sm:flex">
            <LanguageSwitcher />
          </li>
          <li>
            <ThemeToggle />
          </li>
          <li>
            <Button variant="tertiary" size="sm" onPress={handleLogout}>
              {t('nav.logout')}
            </Button>
          </li>
        </ul>
        </nav>
      </header>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex border-t border-separator bg-background/95 backdrop-blur-xl sm:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <NavLink
          to="/proben"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center py-2 text-center text-xs ${isActive ? 'text-accent font-medium' : 'text-muted'}`
          }
        >
          <MusicalNoteIcon className="w-6 h-6 mb-0.5" />
          <span>{t('nav.rehearsals')}</span>
        </NavLink>
        <NavLink
          to="/informationen"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center py-2 text-center text-xs ${isActive ? 'text-accent font-medium' : 'text-muted'}`
          }
        >
          <InformationCircleIcon className="w-6 h-6 mb-0.5" />
          <span>{t('nav.info_short')}</span>
        </NavLink>
        <NavLink
          to="/qr-checkin"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center py-2 text-center text-xs ${isActive ? 'text-accent font-medium' : 'text-muted'}`
          }
        >
          <QrCodeIcon className="w-6 h-6 mb-0.5" />
          <span>{t('nav.qr_short')}</span>
        </NavLink>
        <NavLink
          to="/einstellungen"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center py-2 text-center text-xs ${isActive ? 'text-accent font-medium' : 'text-muted'}`
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
