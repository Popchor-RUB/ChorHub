import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@heroui/react';
import { MusicalNoteIcon, InformationCircleIcon, Cog6ToothIcon, QrCodeIcon, ClipboardDocumentCheckIcon, CloudIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { ThemeToggle } from '../../components/ThemeToggle';
import { NotificationBell } from '../../components/NotificationBell';
import { IOSInstallGuide } from '../../components/IOSInstallGuide';
import { useIOSInstallGuide } from '../../hooks/useIOSInstallGuide';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { membersApi } from '../../services/api';
import type { VoiceAdminVoice } from '../../types';
import { useEffect, useState } from 'react';

export function MemberLayout() {
  const { memberSession, logoutMember } = useAuthStore();
  const [grantSnapshot, setGrantSnapshot] = useState<{ pathname: string; voices: VoiceAdminVoice[] } | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isCloudPage = location.pathname === '/cloud';
  const { t } = useTranslation();
  const { visible: showGuide, forced: guideForced, dismiss: dismissGuide } = useIOSInstallGuide('chorhub-ios-guide-member');

  useEffect(() => {
    let active = true;
    membersApi.me().then((response) => {
      if (active) setGrantSnapshot({ pathname: location.pathname, voices: response.data.voiceAdminVoices ?? [] });
    }).catch(() => {
      if (active) setGrantSnapshot({ pathname: location.pathname, voices: [] });
    });
    return () => { active = false; };
  }, [location.pathname]);

  const voiceAdminVoices = grantSnapshot?.pathname === location.pathname ? grantSnapshot.voices : [];

  const handleLogout = () => {
    logoutMember();
    navigate('/login');
  };

  return (
    <div className={isCloudPage ? 'flex h-dvh flex-col overflow-hidden' : 'min-h-screen'}>
      {showGuide && !isCloudPage && <IOSInstallGuide forced={guideForced} onDismiss={dismissGuide} />}
      <header className="sticky top-0 z-40 shrink-0 border-b border-separator bg-background/85 backdrop-blur-xl">
        <nav className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 sm:px-6" aria-label="ChorHub">
        <div className="flex items-center gap-2">
          <span className="font-bold text-inherit text-xl">🎵 ChorHub</span>
        </div>
        <ul className="hidden flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:flex md:gap-4">
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
          <li>
            <NavLink
              to="/cloud"
              className={({ isActive }) => isActive ? 'text-accent font-medium' : 'text-muted'}
            >
              {t('nav.cloud')}
            </NavLink>
          </li>
          {voiceAdminVoices.length > 0 && <li>
            <NavLink
              to="/anwesenheit"
              data-testid="voice-admin-nav"
              className={({ isActive }) => isActive ? 'text-accent font-medium' : 'text-muted'}
            >
              {t('nav.voice_admin')}
            </NavLink>
          </li>}
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
      <nav
        id="member-bottom-nav"
        data-testid="member-bottom-nav"
        className={`${isCloudPage ? 'relative order-last shrink-0' : 'fixed inset-x-0 bottom-0'} z-50 flex min-w-0 border-t border-separator bg-background/95 backdrop-blur-xl sm:hidden`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <NavLink
          to="/proben"
          className={({ isActive }) =>
            `min-w-0 flex-1 flex flex-col items-center py-2 text-center text-xs ${isActive ? 'text-accent font-medium' : 'text-muted'}`
          }
        >
          <MusicalNoteIcon className="mb-0.5 h-5 w-5 shrink-0" />
          <span className="max-w-full break-words px-0.5 leading-tight">{t('nav.rehearsals')}</span>
        </NavLink>
        <NavLink
          to="/informationen"
          className={({ isActive }) =>
            `min-w-0 flex-1 flex flex-col items-center py-2 text-center text-xs ${isActive ? 'text-accent font-medium' : 'text-muted'}`
          }
        >
          <InformationCircleIcon className="mb-0.5 h-5 w-5 shrink-0" />
          <span className="max-w-full break-words px-0.5 leading-tight">{t('nav.info_short')}</span>
        </NavLink>
        <NavLink
          to="/qr-checkin"
          className={({ isActive }) =>
            `min-w-0 flex-1 flex flex-col items-center py-2 text-center text-xs ${isActive ? 'text-accent font-medium' : 'text-muted'}`
          }
        >
          <QrCodeIcon className="mb-0.5 h-5 w-5 shrink-0" />
          <span className="max-w-full break-words px-0.5 leading-tight">{t('nav.qr_short')}</span>
        </NavLink>
        <NavLink
          to="/cloud"
          className={({ isActive }) =>
            `min-w-0 flex-1 flex flex-col items-center py-2 text-center text-xs ${isActive ? 'text-accent font-medium' : 'text-muted'}`
          }
        >
          <CloudIcon className="mb-0.5 h-5 w-5 shrink-0" />
          <span className="max-w-full break-words px-0.5 leading-tight">{t('nav.cloud')}</span>
        </NavLink>
        {voiceAdminVoices.length > 0 && <NavLink
          to="/anwesenheit"
          data-testid="voice-admin-nav"
          className={({ isActive }) =>
            `min-w-0 flex-1 flex flex-col items-center py-2 text-center text-xs ${isActive ? 'text-accent font-medium' : 'text-muted'}`
          }
        >
          <ClipboardDocumentCheckIcon className="mb-0.5 h-5 w-5 shrink-0" />
          <span className="max-w-full break-words px-0.5 leading-tight">{t('nav.voice_admin_short')}</span>
        </NavLink>}
        <NavLink
          to="/einstellungen"
          className={({ isActive }) =>
            `min-w-0 flex-1 flex flex-col items-center py-2 text-center text-xs ${isActive ? 'text-accent font-medium' : 'text-muted'}`
          }
        >
          <Cog6ToothIcon className="mb-0.5 h-5 w-5 shrink-0" />
          <span className="max-w-full break-words px-0.5 leading-tight">{t('nav.settings_short')}</span>
        </NavLink>
      </nav>

      <main className={isCloudPage ? 'min-h-0 min-w-0 flex-1 overflow-hidden' : 'mx-auto max-w-2xl px-4 py-6 mobile-nav-pb'}>
        <Outlet />
      </main>
    </div>
  );
}
