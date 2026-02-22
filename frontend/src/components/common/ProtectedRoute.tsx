import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

interface Props {
  role: 'member' | 'admin';
  children: React.ReactNode;
}

export function ProtectedRoute({ role, children }: Props) {
  const { memberSession, adminSession } = useAuthStore();

  if (role === 'admin' && !adminSession) {
    return <Navigate to="/admin/login" replace />;
  }
  if (role === 'member' && !memberSession) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
