import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  Button,
} from '@heroui/react';
import { useAuthStore } from '../../store/authStore';

export function MemberLayout() {
  const { memberSession, logoutMember } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logoutMember();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-default-50">
      <Navbar isBordered>
        <NavbarBrand>
          <span className="font-bold text-inherit text-xl">🎵 ChorHub</span>
        </NavbarBrand>
        <NavbarContent className="hidden sm:flex gap-4" justify="center">
          <NavbarItem>
            <NavLink
              to="/"
              className={({ isActive }) =>
                isActive ? 'text-primary font-medium' : 'text-default-600'
              }
            >
              Übersicht
            </NavLink>
          </NavbarItem>
          <NavbarItem>
            <NavLink
              to="/proben"
              className={({ isActive }) =>
                isActive ? 'text-primary font-medium' : 'text-default-600'
              }
            >
              Proben
            </NavLink>
          </NavbarItem>
        </NavbarContent>
        <NavbarContent justify="end">
          <NavbarItem>
            <span className="text-sm text-default-500 hidden sm:block">
              {memberSession?.firstName} {memberSession?.lastName}
            </span>
          </NavbarItem>
          <NavbarItem>
            <Button variant="flat" size="sm" onPress={handleLogout}>
              Abmelden
            </Button>
          </NavbarItem>
        </NavbarContent>
      </Navbar>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-divider flex">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex-1 py-3 text-center text-xs ${isActive ? 'text-primary font-medium' : 'text-default-500'}`
          }
        >
          Übersicht
        </NavLink>
        <NavLink
          to="/proben"
          className={({ isActive }) =>
            `flex-1 py-3 text-center text-xs ${isActive ? 'text-primary font-medium' : 'text-default-500'}`
          }
        >
          Proben
        </NavLink>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-20 sm:pb-6">
        <Outlet />
      </main>
    </div>
  );
}
