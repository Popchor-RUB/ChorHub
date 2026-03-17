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
} from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';
import { useAuthStore } from '../../store/authStore';
import { ThemeToggle } from '../../components/ThemeToggle';
import { useIdleTimeout } from '../../hooks/useIdleTimeout';

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

const navItems: {
  to: string;
  label: string;
  mobileLabel: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}[] = [
  { to: '/admin/mitglieder', label: 'Mitglieder', mobileLabel: 'Mitglieder', icon: UsersIcon },
  { to: '/admin/proben', label: 'Proben', mobileLabel: 'Proben', icon: MusicalNoteIcon },
  { to: '/admin/anwesenheit', label: 'Anwesenheit', mobileLabel: 'Anwesenheit', icon: CheckCircleIcon },
  { to: '/admin/informationen', label: 'Informationen', mobileLabel: 'Infos', icon: InformationCircleIcon },
  { to: '/admin/benachrichtigungen', label: 'Benachrichtigungen', mobileLabel: 'Mitteil.', icon: BellIcon },
  { to: '/admin/einstellungen', label: 'Einstellungen', mobileLabel: 'Einst.', icon: Cog6ToothIcon },
];

export function AdminLayout() {
  const { adminSession, logoutAdmin } = useAuthStore();
  const navigate = useNavigate();

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
            Admin
          </span>
        </NavbarBrand>
        <NavbarContent className="hidden md:flex gap-4" justify="center">
          {navItems.map((item) => (
            <NavbarItem key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  isActive ? 'text-primary font-medium' : 'text-default-600 hover:text-default-900'
                }
              >
                {item.label}
              </NavLink>
            </NavbarItem>
          ))}
        </NavbarContent>
        <NavbarContent justify="end">
          <NavbarItem>
            <span className="text-sm text-default-500 hidden sm:block">{adminSession?.username}</span>
          </NavbarItem>
          <NavbarItem>
            <ThemeToggle />
          </NavbarItem>
          <NavbarItem>
            <Button variant="flat" size="sm" onPress={handleLogout}>
              Abmelden
            </Button>
          </NavbarItem>
        </NavbarContent>
      </Navbar>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-divider flex z-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2 text-center text-xs ${isActive ? 'text-primary font-semibold' : 'text-default-500'}`
            }
          >
            <item.icon className="w-6 h-6 mb-0.5" />
            <span>{item.mobileLabel}</span>
          </NavLink>
        ))}
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-8">
        <Outlet />
      </main>
    </div>
  );
}
