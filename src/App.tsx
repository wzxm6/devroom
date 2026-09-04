import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabaseConfig } from '@/lib/supabase/config';
import { SetupRequired } from '@/components/SetupRequired';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastProvider } from '@/components/ui/Toast';
import { AuthProvider } from '@/context/AuthContext';
import { WorkspaceProvider } from '@/context/WorkspaceContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Skeleton } from '@/components/ui/LoadingSkeleton';

import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { OnboardingPage } from '@/pages/workspace/OnboardingPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { ProjectsPage } from '@/pages/projects/ProjectsPage';
import { MembersPage } from '@/pages/members/MembersPage';
import { NotificationsPage } from '@/pages/notifications/NotificationsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';

// Heavy routes are code-split so the initial bundle stays lean. Each chunk
// loads on first navigation; the fallback matches the app shell language.
const ChatPage = React.lazy(() =>
  import('@/pages/chat/ChatPage').then((m) => ({ default: m.ChatPage }))
);
const ProjectDetailPage = React.lazy(() =>
  import('@/pages/projects/ProjectDetailPage').then((m) => ({ default: m.ProjectDetailPage }))
);
const PostDetailPage = React.lazy(() =>
  import('@/pages/posts/PostDetailPage').then((m) => ({ default: m.PostDetailPage }))
);
const TasksPage = React.lazy(() =>
  import('@/pages/tasks/TasksPage').then((m) => ({ default: m.TasksPage }))
);

const RouteFallback: React.FC = () => (
  <div role="status" aria-label="Loading page" className="space-y-4 p-1">
    <Skeleton className="h-8 w-64" />
    <Skeleton className="h-40 w-full" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Skeleton className="h-28" />
      <Skeleton className="h-28" />
      <Skeleton className="h-28" />
    </div>
  </div>
);

export const App: React.FC = () => {
  // If Supabase credentials are missing and not in explicit demo mode, show the setup instructions
  if (!supabaseConfig.isConfigured && !supabaseConfig.isDemoMode) {
    return <SetupRequired />;
  }

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <ToastProvider>
          <AuthProvider>
            <WorkspaceProvider>
              <React.Suspense fallback={<RouteFallback />}>
                <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />

            {/* Authenticated Workspace Application Layout */}
            <Route path="/" element={<AppLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="projects/:projectId" element={<ProjectDetailPage />} />
              <Route path="projects/:projectId/posts/:postId" element={<PostDetailPage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="members" element={<MembersPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </React.Suspense>
            </WorkspaceProvider>
          </AuthProvider>
        </ToastProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default App;
