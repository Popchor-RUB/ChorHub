import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { MemberLayout } from './pages/member/MemberLayout';
import { AdminLayout } from './pages/admin/AdminLayout';
import { InformationenPage } from './pages/member/DashboardPage';
import { RehearsalsPage } from './pages/member/RehearsalsPage';
import { MagicLinkRequestPage } from './pages/auth/MagicLinkRequestPage';
import { MagicLinkVerifyPage } from './pages/auth/MagicLinkVerifyPage';
import { LoginPage } from './pages/admin/LoginPage';
import { MemberOverviewPage } from './pages/admin/MemberOverviewPage';
import { ImportMembersPage } from './pages/admin/ImportMembersPage';
import { GeneralInfoPage } from './pages/admin/GeneralInfoPage';
import { AttendancePage } from './pages/admin/AttendancePage';
import { RehearsalOverviewPage } from './pages/admin/RehearsalOverviewPage';
import { PushNotificationsPage } from './pages/admin/PushNotificationsPage';

// Get basename from Vite's __BASE_PATH__ (defaults to '/')
const basename = __BASE_PATH__;

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
      children: [
        { index: true, element: <Navigate to="/proben" replace /> },
        { path: 'proben', element: <RehearsalsPage /> },
        { path: 'informationen', element: <InformationenPage /> },
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
      children: [
        { index: true, element: <Navigate to="/admin/mitglieder" replace /> },
        { path: 'mitglieder', element: <MemberOverviewPage /> },
        { path: 'mitglieder/importieren', element: <ImportMembersPage /> },
        { path: 'proben', element: <RehearsalOverviewPage /> },
        { path: 'anwesenheit', element: <AttendancePage /> },
        { path: 'informationen', element: <GeneralInfoPage /> },
        { path: 'benachrichtigungen', element: <PushNotificationsPage /> },
      ],
    },

    // Public auth routes
    { path: '/login', element: <MagicLinkRequestPage /> },
    { path: '/auth/verify', element: <MagicLinkVerifyPage /> },
    { path: '/admin/login', element: <LoginPage /> },
    { path: '*', element: <Navigate to="/" replace /> },
  ],
  { basename },
);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
