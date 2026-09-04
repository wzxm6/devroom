import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  FolderGit2,
  CheckSquare,
  Users,
  Copy,
  Check,
  Plus,
  Shield,
  Activity,
  ArrowRight,
  Bell,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useProjects } from '@/hooks/useProjects';
import { useActivityFeed } from '@/hooks/useActivityFeed';
import { useNotifications } from '@/hooks/useNotifications';
import { ActivityFeed } from '@/components/activity/ActivityFeed';
import { taskService } from '@/services/taskService';
import { TaskFull } from '@/types/task';
import { ProjectStatusBadge } from '@/components/projects/ProjectStatusBadge';
import { StatusBadge } from '@/components/tasks/StatusBadge';
import { CreateProjectDialog } from '@/components/projects/CreateProjectDialog';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/LoadingSkeleton';
import { formatTimeAgo } from '@/lib/utils';

export const DashboardPage: React.FC = () => {
  const { profile, user } = useAuth();
  const { currentWorkspace, members, memberCount, maxMembers, isOwner } = useWorkspace();
  const { projects, createProject } = useProjects();
  const navigate = useNavigate();

  const [copiedCode, setCopiedCode] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [workspaceTasks, setWorkspaceTasks] = useState<TaskFull[]>([]);
  const [tasksLoading, setTasksLoading] = useState<boolean>(true);
  const [tasksError, setTasksError] = useState<string | null>(null);

  // Load workspace tasks for the metric cards and recent-tasks list.
  // States are tracked explicitly so the UI never shows fake zeros: loading
  // shows skeletons, failures show an error fallback instead of empty data.
  useEffect(() => {
    if (!currentWorkspace) {
      setWorkspaceTasks([]);
      setTasksLoading(false);
      setTasksError(null);
      return;
    }
    let cancelled = false;
    setTasksLoading(true);
    setTasksError(null);
    taskService
      .getWorkspaceTasks(currentWorkspace.id)
      .then((data) => {
        if (cancelled) return;
        setWorkspaceTasks(data);
        setTasksLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setWorkspaceTasks([]);
        setTasksLoading(false);
        setTasksError(err instanceof Error ? err.message : 'Unable to load tasks.');
      });
    return () => {
      cancelled = true;
    };
  }, [currentWorkspace]);

  const refreshTasks = useCallback(() => {
    if (!currentWorkspace) return;
    setTasksLoading(true);
    setTasksError(null);
    taskService
      .getWorkspaceTasks(currentWorkspace.id)
      .then((data) => {
        setWorkspaceTasks(data);
        setTasksLoading(false);
      })
      .catch((err: unknown) => {
        setWorkspaceTasks([]);
        setTasksLoading(false);
        setTasksError(err instanceof Error ? err.message : 'Unable to load tasks.');
      });
  }, [currentWorkspace]);

  // Dynamic greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Developer';

  const copyInviteCode = () => {
    if (currentWorkspace?.invite_code) {
      navigator.clipboard.writeText(currentWorkspace.invite_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const activeProjectsCount = projects.filter((p) => p.status === 'ACTIVE').length;
  const recentProjects = projects.slice(0, 3);
  const openTasks = workspaceTasks.filter((t) => t.status !== 'DONE');
  const myOpenTasks = user ? openTasks.filter((t) => t.assigned_to === user.id) : [];
  const recentTasks = workspaceTasks.slice(0, 3);

  // Minimal live preview for the dashboard (full timeline lives on projects)
  const {
    events: recentActivity,
    loading: loadingActivity,
    error: activityError,
    refreshActivity,
  } = useActivityFeed({ workspaceId: currentWorkspace?.id, limit: 5 });

  const { unreadCount } = useNotifications();

  return (
    <div className="space-y-6">
      {/* Top Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {getGreeting()}, {displayName}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Workspace: <span className="text-foreground font-medium">{currentWorkspace?.name}</span>
          </p>
        </div>

        {/* Quick action: Invite teammates */}
        <div className="flex items-center gap-2">
          {currentWorkspace?.invite_code && (
            <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-md">
              <span className="text-[11px] text-muted-foreground font-mono">Invite Code:</span>
              <span className="font-mono text-xs font-semibold text-primary uppercase tracking-wider">
                {currentWorkspace.invite_code}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={copyInviteCode}
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                title="Copy Invite Code"
              >
                {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Unread notifications nudge (only when there is something to see) */}
      {unreadCount > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <Bell className="h-4 w-4 text-primary shrink-0" />
            <p className="text-xs text-foreground truncate">
              You have{' '}
              <strong className="font-mono">
                {unreadCount} unread notification{unreadCount === 1 ? '' : 's'}
              </strong>
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/notifications')}
            className="text-xs h-7 self-start sm:self-auto shrink-0"
          >
            View notifications
          </Button>
        </div>
      )}

      {/* 4 Metric Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Active Projects</span>
            <FolderGit2 className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-foreground">{activeProjectsCount}</div>
          <span className="text-[11px] text-muted-foreground">
            {projects.length} total project(s)
          </span>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Open Tasks</span>
            <CheckSquare className="h-4 w-4 text-amber-400" />
          </div>
          {tasksLoading ? (
            <Skeleton className="mt-2 h-8 w-16" />
          ) : (
            <div className="mt-2 text-2xl font-bold font-mono text-foreground">
              {tasksError ? '—' : openTasks.length}
            </div>
          )}
          <span className="text-[11px] text-muted-foreground">
            {tasksError ? 'Could not load tasks' : 'Across workspace projects'}
          </span>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">My Tasks</span>
            <CheckSquare className="h-4 w-4 text-emerald-400" />
          </div>
          {tasksLoading ? (
            <Skeleton className="mt-2 h-8 w-16" />
          ) : (
            <div className="mt-2 text-2xl font-bold font-mono text-foreground">
              {tasksError ? '—' : myOpenTasks.length}
            </div>
          )}
          <span className="text-[11px] text-muted-foreground">
            {tasksError ? 'Could not load tasks' : 'Open tasks assigned to you'}
          </span>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Team Capacity</span>
            <Users className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-foreground">
            {memberCount} <span className="text-xs font-normal text-muted-foreground">/ {maxMembers}</span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {maxMembers - memberCount === 0 ? 'Workspace is full' : `${maxMembers - memberCount} seat(s) available`}
          </span>
        </Card>
      </div>

      {/* Main Content Grid: Projects/Tasks on left, Activity & Members on right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Projects Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FolderGit2 className="h-4 w-4 text-primary" />
                Recent Projects
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateProjectOpen(true)}
                  className="text-xs h-7"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  New Project
                </Button>
                {projects.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/projects')}
                    className="text-xs h-7 text-muted-foreground"
                  >
                    View All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {projects.length === 0 ? (
                <EmptyState
                  icon={FolderGit2}
                  title="No projects yet"
                  description="Projects hold your posts, discussions, tasks, and files. Create your first project now."
                  actionLabel="Create Project"
                  onAction={() => setIsCreateProjectOpen(true)}
                />
              ) : (
                <div className="divide-y divide-border/60">
                  {recentProjects.map((project) => (
                    <Link
                      key={project.id}
                      to={`/projects/${project.id}`}
                      className="group flex items-center justify-between py-3 first:pt-0 last:pb-0 hover:bg-muted/30 px-2 rounded-md transition-colors"
                    >
                      <div className="min-w-0 flex-1 pr-4">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                            {project.name}
                          </span>
                          <ProjectStatusBadge status={project.status} />
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {project.description || 'No description provided.'}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 text-[11px] text-muted-foreground">
                        <span className="hidden sm:inline font-mono">
                          {formatTimeAgo(project.updated_at)}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Tasks Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-amber-400" />
                Recent Tasks
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/tasks')}
                className="text-xs h-7"
              >
                View All
              </Button>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <div className="divide-y divide-border/60">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div className="space-y-1.5 flex-1 pr-4">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                      <Skeleton className="h-4 w-4" />
                    </div>
                  ))}
                </div>
              ) : tasksError ? (
                <div className="p-4 text-center space-y-3">
                  <AlertCircle className="h-6 w-6 text-destructive mx-auto" />
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">{tasksError}</p>
                  <Button variant="outline" size="sm" onClick={refreshTasks} className="text-xs">
                    <RefreshCw className="h-3 w-3 mr-1.5" />
                    Retry
                  </Button>
                </div>
              ) : recentTasks.length === 0 ? (
                <EmptyState
                  icon={CheckSquare}
                  title="No tasks yet"
                  description="Tasks created in any workspace project will appear here."
                  actionLabel="Explore Tasks"
                  onAction={() => navigate('/tasks')}
                />
              ) : (
                <div className="divide-y divide-border/60">
                  {recentTasks.map((task) => (
                    <Link
                      key={task.id}
                      to={`/projects/${task.project_id}`}
                      className="group flex items-center justify-between py-3 first:pt-0 last:pb-0 hover:bg-muted/30 px-2 rounded-md transition-colors"
                    >
                      <div className="min-w-0 flex-1 pr-4">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                            {task.title}
                          </span>
                          <StatusBadge status={task.status} />
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {task.project?.name || 'Project task'}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 text-[11px] text-muted-foreground">
                        <span className="hidden sm:inline font-mono">
                          {formatTimeAgo(task.updated_at)}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Column */}
        <div className="space-y-6">
          {/* Team Members Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Team Members ({memberCount}/{maxMembers})
                </CardTitle>
                <Badge variant={memberCount >= maxMembers ? 'warning' : 'success'}>
                  {memberCount >= maxMembers ? 'Max Reached' : `${maxMembers - memberCount} Open`}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar
                      size="sm"
                      src={member.profile?.avatar_url}
                      name={member.profile?.display_name || 'Member'}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-foreground truncate">
                        {member.profile?.display_name || 'Collaborator'}
                        {member.user_id === user?.id && (
                          <span className="text-[10px] text-muted-foreground ml-1.5">(You)</span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono truncate">
                        @{member.profile?.username || 'user'}
                      </div>
                    </div>
                  </div>
                  <Badge variant={member.role === 'owner' ? 'default' : 'secondary'} className="text-[10px]">
                    {member.role === 'owner' ? (
                      <span className="flex items-center gap-1">
                        <Shield className="h-3 w-3" /> Owner
                      </span>
                    ) : (
                      'Member'
                    )}
                  </Badge>
                </div>
              ))}

              {memberCount < maxMembers && (
                <div className="mt-3 p-3 rounded-md border border-dashed border-border bg-card/50 space-y-2">
                  <div className="text-xs font-medium text-foreground">Invite Teammates</div>
                  <p className="text-[11px] text-muted-foreground">
                    Share your workspace invite code with your teammates so they can join immediately.
                  </p>
                  {isOwner && currentWorkspace?.invite_code && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyInviteCode}
                      className="w-full text-xs"
                    >
                      {copiedCode ? (
                        <>
                          <Check className="h-3.5 w-3.5 mr-1 text-emerald-400" />
                          Copied Code
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 mr-1" />
                          Copy Invite Code
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-400" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityFeed
                events={recentActivity}
                loading={loadingActivity}
                error={activityError}
                onRefresh={refreshActivity}
                compact
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Project Dialog */}
      <CreateProjectDialog
        isOpen={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
        onSubmit={async (input) => {
          await createProject(input);
        }}
      />
    </div>
  );
};
