import { useEffect } from 'react';
import { useThemeStore } from '../store/themeStore';

function applyTheme(isDark: boolean) {
  document.documentElement.classList.toggle('dark', isDark);
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) {
    meta.content = isDark ? '#18181b' : '#ffffff';
  }
}

export function useTheme() {
  const { preference } = useThemeStore();

  useEffect(() => {
    if (preference === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const apply = () => applyTheme(mq.matches);
      apply();
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    } else {
      applyTheme(preference === 'dark');
    }
  }, [preference]);
}
