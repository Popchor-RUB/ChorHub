import { Button } from '@heroui/react';
import type { ThemePreference } from '../store/themeStore';
import { useThemeStore } from '../store/themeStore';

const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

// Sun (top-left) and moon (bottom-right) split by a diagonal "\" line
const AutoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* Sun rays and partial circle clipped to top-left triangle */}
    <circle cx="6" cy="6" r="3" />
    <line x1="6" y1="1" x2="6" y2="2.5" />
    <line x1="1" y1="6" x2="2.5" y2="6" />
    <line x1="2.64" y1="2.64" x2="3.7" y2="3.7" />
    {/* Moon clipped to bottom-right triangle */}
    <path d="M17 21a5 5 0 0 1-1-9.9A4 4 0 1 0 21 17a5 5 0 0 1-4 4z" />
    {/* Diagonal divider */}
    <line x1="3" y1="21" x2="21" y2="3" />
  </svg>
);

const CYCLE: ThemePreference[] = ['system', 'light', 'dark'];

const ARIA_LABELS: Record<ThemePreference, string> = {
  system: 'Automatischer Modus (System)',
  light: 'Heller Modus',
  dark: 'Dunkler Modus',
};

const ICONS: Record<ThemePreference, () => React.ReactElement> = {
  system: AutoIcon,
  light: SunIcon,
  dark: MoonIcon,
};

export function ThemeToggle() {
  const { preference, setPreference } = useThemeStore();

  const cycle = () => {
    const idx = CYCLE.indexOf(preference);
    setPreference(CYCLE[(idx + 1) % CYCLE.length]);
  };

  const Icon = ICONS[preference];

  return (
    <Button
      isIconOnly
      variant="light"
      size="sm"
      onPress={cycle}
      aria-label={ARIA_LABELS[preference]}
    >
      <Icon />
    </Button>
  );
}
