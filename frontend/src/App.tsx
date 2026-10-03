import { Suspense, lazy } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { normalizeBasePath } from './utils/basePath';
import { RouteErrorBoundary } from './components/common/RouteErrorBoundary';

const basename = normalizeBasePath(import.meta.env.VITE_BASE_PATH);

const MemberLayout = lazy(() => import('./pages/member/MemberLayout').then((module) => ({ default: module.MemberLayout })));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout').then((module) => ({ default: module.AdminLayout })));

const InformationenPage = lazy(() => import('./pages/member/DashboardPage').then((module) => ({ default: module.InformationenPage })));
const RehearsalsPage = lazy(() => import('./pages/member/RehearsalsPage').then((module) => ({ default: module.RehearsalsPage })));
const MemberSettingsPage = lazy(() => import('./pages/member/MemberSettingsPage').then((module) => ({ default: module.MemberSettingsPage })));
const MemberCloudPage = lazy(() => import('./pages/member/MemberCloudPage').then((module) => ({ default: module.MemberCloudPage })));
const MemberQrCheckinPage = lazy(() => import('./pages/member/MemberQrCheckinPage').then((module) => ({ default: module.MemberQrCheckinPage })));
const VoiceAdminAttendancePage = lazy(() => import('./pages/member/VoiceAdminAttendancePage').then((module) => ({ default: module.VoiceAdminAttendancePage })));

const MagicLinkRequestPage = lazy(() => import('./pages/auth/MagicLinkRequestPage').then((module) => ({ default: module.MagicLinkRequestPage })));
const MagicLinkVerifyPage = lazy(() => import('./pages/auth/MagicLinkVerifyPage').then((module) => ({ default: module.MagicLinkVerifyPage })));
const LoginPage = lazy(() => import('./pages/admin/LoginPage').then((module) => ({ default: module.LoginPage })));

const MemberOverviewPage = lazy(() => import('./pages/admin/MemberOverviewPage').then((module) => ({ default: module.MemberOverviewPage })));
const AdminMemberDetailPage = lazy(() => import('./pages/admin/AdminMemberDetailPage').then((module) => ({ default: module.AdminMemberDetailPage })));
const ImportMembersPage = lazy(() => import('./pages/admin/ImportMembersPage').then((module) => ({ default: module.ImportMembersPage })));
const GeneralInfoPage = lazy(() => import('./pages/admin/GeneralInfoPage').then((module) => ({ default: module.GeneralInfoPage })));
const PersonalInfoPage = lazy(() => import('./pages/admin/PersonalInfoPage').then((module) => ({ default: module.PersonalInfoPage })));
const EmailInfoPage = lazy(() => import('./pages/admin/EmailInfoPage').then((module) => ({ default: module.EmailInfoPage })));
const AttendancePage = lazy(() => import('./pages/admin/AttendancePage').then((module) => ({ default: module.AttendancePage })));
const RehearsalOverviewPage = lazy(() => import('./pages/admin/RehearsalOverviewPage').then((module) => ({ default: module.RehearsalOverviewPage })));
const PushNotificationsPage = lazy(() => import('./pages/admin/PushNotificationsPage').then((module) => ({ default: module.PushNotificationsPage })));
const OptionsPage = lazy(() => import('./pages/admin/OptionsPage').then((module) => ({ default: module.OptionsPage })));

const AdminMailTemplatesPage = lazy(() => import('./pages/admin/AdminMailTemplatesPage').then((module) => ({ default: module.AdminMailTemplatesPage })));
const AdminCloudSettingsPage = lazy(() => import('./pages/admin/AdminCloudSettingsPage').then((module) => ({ default: module.AdminCloudSettingsPage })));

function LoadingScreen() {
  return <div className="min-h-[30vh] flex items-center justify-center text-muted text-sm">Lädt...</div>;
}

function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingScreen />}>{children}</Suspense>;
}

const router = createBrowserRouter(
  [
    // Member routes
    {
      path: '/',
      element: (
        <ProtectedRoute role="member">
          <LazyPage>
            <MemberLayout />
          </LazyPage>
        </ProtectedRoute>
      ),
      errorElement: <RouteErrorBoundary />,
      children: [
        { index: true, element: <Navigate to="/proben" replace /> },
        { path: 'proben', element: <LazyPage><RehearsalsPage /></LazyPage> },
        { path: 'qr-checkin', element: <LazyPage><MemberQrCheckinPage /></LazyPage> },
        { path: 'anwesenheit', element: <LazyPage><VoiceAdminAttendancePage /></LazyPage> },
        { path: 'informationen', element: <LazyPage><InformationenPage /></LazyPage> },
        { path: 'einstellungen', element: <LazyPage><MemberSettingsPage /></LazyPage> },
        { path: 'cloud', element: <LazyPage><MemberCloudPage /></LazyPage> },
      ],
    },

    // Admin routes
    {
      path: '/admin',
      element: (
        <ProtectedRoute role="admin">
          <LazyPage>
            <AdminLayout />
          </LazyPage>
        </ProtectedRoute>
      ),
      errorElement: <RouteErrorBoundary />,
      children: [
        { index: true, element: <Navigate to="/admin/mitglieder" replace /> },
        { path: 'mitglieder', element: <LazyPage><MemberOverviewPage /></LazyPage> },
        { path: 'mitglieder/:memberId', element: <LazyPage><AdminMemberDetailPage /></LazyPage> },
        { path: 'mitglieder/importieren', element: <LazyPage><ImportMembersPage /></LazyPage> },
        { path: 'proben', element: <LazyPage><RehearsalOverviewPage /></LazyPage> },
        { path: 'anwesenheit', element: <LazyPage><AttendancePage /></LazyPage> },
        { path: 'informationen', element: <LazyPage><GeneralInfoPage /></LazyPage> },
        { path: 'informationen/persoenlich', element: <LazyPage><PersonalInfoPage /></LazyPage> },
        { path: 'informationen/email', element: <LazyPage><EmailInfoPage /></LazyPage> },
        { path: 'benachrichtigungen', element: <LazyPage><PushNotificationsPage /></LazyPage> },
        { path: 'einstellungen', element: <LazyPage><OptionsPage /></LazyPage> },
        { path: 'einstellungen/email-templates', element: <LazyPage><AdminMailTemplatesPage /></LazyPage> },
        { path: 'einstellungen/cloud', element: <LazyPage><AdminCloudSettingsPage /></LazyPage> },
      ],
    },

    // Public auth routes
    { path: '/login', element: <LazyPage><MagicLinkRequestPage /></LazyPage>, errorElement: <RouteErrorBoundary /> },
    { path: '/auth/verify', element: <LazyPage><MagicLinkVerifyPage /></LazyPage>, errorElement: <RouteErrorBoundary /> },
    { path: '/admin/login', element: <LazyPage><LoginPage /></LazyPage>, errorElement: <RouteErrorBoundary /> },
    { path: '*', element: <Navigate to="/" replace />, errorElement: <RouteErrorBoundary /> },
  ],
  { basename },
);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
