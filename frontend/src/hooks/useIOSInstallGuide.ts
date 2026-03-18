import { useState } from 'react';

const FORCE_PWA = import.meta.env.VITE_FORCE_IOS_PWA === '1';
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function isIOSSafariNotStandalone(): boolean {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (!isIOS) return false;
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return !isStandalone;
}

function isDue(storageKey: string): boolean {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return true;
  return Date.now() - Number(raw) >= THREE_DAYS_MS;
}

export function useIOSInstallGuide(storageKey: string) {
  const [visible, setVisible] = useState(() => {
    if (!isIOSSafariNotStandalone()) return false;
    if (FORCE_PWA) return true;
    return isDue(storageKey);
  });

  const dismiss = () => {
    localStorage.setItem(storageKey, String(Date.now()));
    setVisible(false);
  };

  return { visible, forced: FORCE_PWA, dismiss };
}
