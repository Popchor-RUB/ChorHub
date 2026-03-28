import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

interface Props {
  role: 'member' | 'admin';
  children: React.ReactNode;
}

export function ProtectedRoute({ role, children }: Props) {
  const { memberSession, adminSession } = useAuthStore();
  const [hasHydrated, setHasHydrated] = useState(() => useAuthStore.persist.hasHydrated());

  useEffect(() => {
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => setHasHydrated(true));
    return unsubscribe;
  }, []);

  if (!hasHydrated) {
    return <div className="min-h-[30vh] flex items-center justify-center text-default-500 text-sm">Lädt...</div>;
  }

  if (role === 'admin' && !adminSession) {
    return <Navigate to="/admin/login" replace />;
  }
  if (role === 'member' && !memberSession) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
