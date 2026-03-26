import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { MemberLayout } from './pages/member/MemberLayout';
import { AdminLayout } from './pages/admin/AdminLayout';
import { InformationenPage } from './pages/member/DashboardPage';
import { RehearsalsPage } from './pages/member/RehearsalsPage';
import { MemberSettingsPage } from './pages/member/MemberSettingsPage';
import { MagicLinkRequestPage } from './pages/auth/MagicLinkRequestPage';
import { MagicLinkVerifyPage } from './pages/auth/MagicLinkVerifyPage';
import { LoginPage } from './pages/admin/LoginPage';
import { MemberOverviewPage } from './pages/admin/MemberOverviewPage';
import { ImportMembersPage } from './pages/admin/ImportMembersPage';
import { GeneralInfoPage } from './pages/admin/GeneralInfoPage';
import { AttendancePage } from './pages/admin/AttendancePage';
import { RehearsalOverviewPage } from './pages/admin/RehearsalOverviewPage';
import { PushNotificationsPage } from './pages/admin/PushNotificationsPage';
import { OptionsPage } from './pages/admin/OptionsPage';
import { normalizeBasePath } from './utils/basePath';
import { RouteErrorBoundary } from './components/common/RouteErrorBoundary';

const basename = normalizeBasePath(import.meta.env.VITE_BASE_PATH);

const router = createBrowserRouter(
  [
    // Member routes
    {
      path: '/',
      element: (
        <ProtectedRoute role="member">
          <MemberLayout />
        </ProtectedRoute>
      ),
      errorElement: <RouteErrorBoundary />,
      children: [
        { index: true, element: <Navigate to="/proben" replace /> },
        { path: 'proben', element: <RehearsalsPage /> },
        { path: 'informationen', element: <InformationenPage /> },
        { path: 'einstellungen', element: <MemberSettingsPage /> },
      ],
    },

    // Admin routes
    {
      path: '/admin',
      element: (
        <ProtectedRoute role="admin">
          <AdminLayout />
        </ProtectedRoute>
      ),
      errorElement: <RouteErrorBoundary />,
      children: [
        { index: true, element: <Navigate to="/admin/mitglieder" replace /> },
        { path: 'mitglieder', element: <MemberOverviewPage /> },
        { path: 'mitglieder/importieren', element: <ImportMembersPage /> },
        { path: 'proben', element: <RehearsalOverviewPage /> },
        { path: 'anwesenheit', element: <AttendancePage /> },
        { path: 'informationen', element: <GeneralInfoPage /> },
        { path: 'benachrichtigungen', element: <PushNotificationsPage /> },
        { path: 'einstellungen', element: <OptionsPage /> },
      ],
    },

    // Public auth routes
    { path: '/login', element: <MagicLinkRequestPage />, errorElement: <RouteErrorBoundary /> },
    { path: '/auth/verify', element: <MagicLinkVerifyPage />, errorElement: <RouteErrorBoundary /> },
    { path: '/admin/login', element: <LoginPage />, errorElement: <RouteErrorBoundary /> },
    { path: '*', element: <Navigate to="/" replace />, errorElement: <RouteErrorBoundary /> },
  ],
  { basename },
);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
