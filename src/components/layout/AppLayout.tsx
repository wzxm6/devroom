import React, { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Skeleton } from '@/components/ui/LoadingSkeleton';

export const AppLayout: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace, loading: wsLoading } = useWorkspace();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Authentication Guard
  if (!authLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  // Workspace Onboarding Guard: if user has no workspace, send to /onboarding
  if (!authLoading && !wsLoading && user && !currentWorkspace) {
    return <Navigate to="/onboarding" replace />;
  }

  if (authLoading || wsLoading) {
    return (
      <div className="flex h-screen w-full bg-background">
        <div className="hidden md:flex w-64 flex-col border-r border-border p-4 space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-10 w-full" />
          <div className="space-y-2 pt-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
        <div className="flex-1 flex flex-col">
          <div className="h-14 border-b border-border p-4 flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <div className="flex-1 p-6 space-y-6">
            <Skeleton className="h-28 w-full" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Sidebar Navigation */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Workspace Frame */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar onOpenSidebar={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
