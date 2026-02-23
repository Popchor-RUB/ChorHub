import { useEffect, useRef, useState } from 'react';
import { pushApi } from '../services/api';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output.buffer as ArrayBuffer;
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const swPath = __BASE_PATH__ + 'sw.js';
    navigator.serviceWorker
      .register(swPath)
      .then((reg) => {
        registrationRef.current = reg;
        return reg.pushManager.getSubscription();
      })
      .then((sub) => {
        setIsSubscribed(sub !== null);
      })
      .catch(() => {
        // SW registration failed (e.g. in dev without HTTPS) — silently ignore
      });
  }, []);

  const subscribe = async () => {
    if (!registrationRef.current) return;
    setIsLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return;

      const { data } = await pushApi.getVapidPublicKey();
      const sub = await registrationRef.current.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      });

      const json = sub.toJSON();
      await pushApi.subscribe({
        endpoint: sub.endpoint,
        p256dh: (json.keys as Record<string, string>).p256dh,
        auth: (json.keys as Record<string, string>).auth,
      });
      setIsSubscribed(true);
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribe = async () => {
    if (!registrationRef.current) return;
    setIsLoading(true);
    try {
      const sub = await registrationRef.current.pushManager.getSubscription();
      if (sub) {
        await pushApi.unsubscribe(sub.endpoint);
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
    } finally {
      setIsLoading(false);
    }
  };

  return { permission, isSubscribed, subscribe, unsubscribe, isLoading };
}
