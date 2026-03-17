import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HeroUIProvider } from '@heroui/react';
import './index.css';
import './i18n';
import App from './App.tsx';
import { useTheme } from './hooks/useTheme.ts';

function ThemeInitializer({ children }: { children: React.ReactNode }) {
  useTheme();
  return <>{children}</>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HeroUIProvider>
      <ThemeInitializer>
        <App />
      </ThemeInitializer>
    </HeroUIProvider>
  </StrictMode>,
);
