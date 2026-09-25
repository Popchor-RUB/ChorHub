/* eslint-disable react-refresh/only-export-components */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
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
    <ThemeInitializer>
      <App />
    </ThemeInitializer>
  </StrictMode>,
);
