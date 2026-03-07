import { useEffect, useRef } from 'react';

export function useIdleTimeout(onIdle: () => void, timeoutMs: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    const reset = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => onIdleRef.current(), timeoutMs);
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      clearTimeout(timer.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [timeoutMs]);
}
