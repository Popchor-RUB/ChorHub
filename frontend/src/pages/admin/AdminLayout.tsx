import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  Button,
} from '@heroui/react';
import { useAuthStore } from '../../store/authStore';
import { ThemeToggle } from '../../components/ThemeToggle';

const navItems = [
  { to: '/admin/mitglieder', label: 'Mitglieder' },
  { to: '/admin/proben', label: 'Proben' },
  { to: '/admin/anwesenheit', label: 'Anwesenheit' },
  { to: '/admin/informationen', label: 'Informationen' },
];

export function AdminLayout() {
  const { adminSession, logoutAdmin } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logoutAdmin();
    navigate('/admin/login');
  };

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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-divider flex z-50">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex-1 py-3 text-center text-xs ${isActive ? 'text-primary font-semibold' : 'text-default-500'}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-8">
        <Outlet />
      </main>
    </div>
  );
}
