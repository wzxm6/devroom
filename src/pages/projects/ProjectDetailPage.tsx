import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Edit2,
  Archive,
  Trash2,
  FileText,
  MessageSquare,
  CheckSquare,
  FolderArchive,
  Activity,
  AlertCircle,
  Users,
  Layers,
  Plus,
  RefreshCw,
  CheckCircle2,
  Clock3,
  AlertTriangle,
} from 'lucide-react';
import { Project, ProjectStatus, UpdateProjectInput } from '@/types/project';
import { Post, CreatePostInput } from '@/types/post';
import { TaskFull, TaskStatus, CreateTaskInput, UpdateTaskInput } from '@/types/task';
import { projectService } from '@/services/projectService';
import { postService } from '@/services/postService';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useProjectTasks } from '@/hooks/useProjectTasks';
import { useProjectChat } from '@/hooks/useProjectChat';
import { useProjectFiles } from '@/hooks/useProjectFiles';
import { ProjectStatusBadge } from '@/components/projects/ProjectStatusBadge';
import { EditProjectDialog } from '@/components/projects/EditProjectDialog';
import { DeleteProjectDialog } from '@/components/projects/DeleteProjectDialog';
import { CreatePostDialog } from '@/components/posts/CreatePostDialog';
import { PostCard } from '@/components/posts/PostCard';
import { TaskBoard } from '@/components/tasks/TaskBoard';
import { TaskList } from '@/components/tasks/TaskList';
import { TaskFiltersBar, TaskFilterValues } from '@/components/tasks/TaskFiltersBar';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';
import { EditTaskDialog } from '@/components/tasks/EditTaskDialog';
import { DeleteTaskDialog } from '@/components/tasks/DeleteTaskDialog';
import { TaskDetailDialog } from '@/components/tasks/TaskDetailDialog';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { ActivityFeed } from '@/components/activity/ActivityFeed';
import { useActivityFeed } from '@/hooks/useActivityFeed';
import { ProjectFilePanel } from '@/components/files/ProjectFilePanel';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/LoadingSkeleton';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate, formatTimeAgo } from '@/lib/utils';
import { getDueDateInfo } from '@/lib/taskUtils';

type ProjectTab = 'overview' | 'posts' | 'discussion' | 'tasks' | 'files' | 'activity';

export const ProjectDetailPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { members, isOwner } = useWorkspace();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // Deep links (?tab=tasks|discussion|files) land directly on the right tab
  const initialTab = ((): ProjectTab => {
    const requested = searchParams.get('tab');
    if (
      requested === 'overview' ||
      requested === 'posts' ||
      requested === 'discussion' ||
      requested === 'tasks' ||
      requested === 'files' ||
      requested === 'activity'
    ) {
      return requested;
    }
    return 'overview';
  })();
  const [activeTab, setActiveTab] = useState<ProjectTab>(initialTab);

  // Posts state
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState<boolean>(false);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);

  // Project management dialogs
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Tasks hook (with realtime synchronization and optimistic updates)
  const {
    tasks,
    loading: loadingTasks,
    error: tasksError,
    operatingError,
    clearOperatingError,
    refreshTasks,
    createTask,
    updateTask,
    updateTaskStatus,
    deleteTask,
  } = useProjectTasks(projectId);

  // Project discussion chat (realtime, scoped to this project)
  const {
    messages: chatMessages,
    loading: loadingChat,
    error: chatError,
    operatingError: chatOperatingError,
    clearOperatingError: clearChatOperatingError,
    refreshMessages: refreshChat,
    sendMessage: sendChatMessage,
    editMessage: editChatMessage,
    deleteMessage: deleteChatMessage,
  } = useProjectChat(projectId);

  // Project files (private storage, scoped to this project)
  const {
    files: projectFiles,
    loading: loadingFiles,
    error: filesError,
    operatingError: filesOperatingError,
    uploading: uploadingFile,
    clearOperatingError: clearFilesOperatingError,
    refreshFiles,
    uploadFile,
    uploadFolder,
    deleteFile,
    getDownloadUrl,
  } = useProjectFiles(projectId);

  // Project activity timeline (poll-based)
  const {
    events: activityEvents,
    loading: loadingActivity,
    error: activityError,
    refreshActivity,
  } = useActivityFeed({ projectId });

  // Task filter & view states
  const [taskFilters, setTaskFilters] = useState<TaskFilterValues>({
    search: '',
    status: 'ALL',
    priority: 'ALL',
    assignedToMe: false,
    overdue: false,
  });
  const [taskViewMode, setTaskViewMode] = useState<'board' | 'list'>('board');

  // Task modal dialogs
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [createTaskDefaultStatus, setCreateTaskDefaultStatus] = useState<TaskStatus>('TODO');
  const [taskForEdit, setTaskForEdit] = useState<TaskFull | null>(null);
  const [taskForDelete, setTaskForDelete] = useState<TaskFull | null>(null);
  const [taskForDetail, setTaskForDetail] = useState<TaskFull | null>(null);

  const loadProject = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await projectService.getProject(projectId);
      if (!data) {
        setError('Project not found or you do not have permission to view it.');
      } else {
        setProject(data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to load project.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadPosts = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoadingPosts(true);
      setPostsError(null);
      const data = await postService.getProjectPosts(projectId);
      setPosts(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to load posts.';
      setPostsError(msg);
    } finally {
      setLoadingPosts(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  useEffect(() => {
    if (activeTab === 'posts') {
      loadPosts();
    }
  }, [activeTab, loadPosts]);

  const handleUpdate = async (id: string, input: UpdateProjectInput) => {
    const updated = await projectService.updateProject(id, input);
    setProject(updated);
  };

  const handleArchive = async () => {
    if (!project) return;
    const nextStatus: ProjectStatus = project.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED';
    const updated = await projectService.updateProject(project.id, { status: nextStatus });
    setProject(updated);
  };

  const handleDelete = async () => {
    if (!project) return;
    await projectService.deleteProject(project.id);
    navigate('/projects');
  };

  const handleCreatePost = async (input: CreatePostInput) => {
    if (!project || !user) return;
    const newPost = await postService.createPost(project.id, user.id, input);
    setPosts((prev) => [newPost, ...prev]);
  };

  // Task Handlers
  const handleCreateTask = async (input: CreateTaskInput) => {
    if (!user) return;
    await createTask(user.id, input);
  };

  const handleUpdateTask = async (taskId: string, input: UpdateTaskInput) => {
    await updateTask(taskId, input);
    if (taskForDetail && taskForDetail.id === taskId) {
      setTaskForDetail((prev) => (prev ? { ...prev, ...input } : null));
    }
  };

  const handleStatusChange = async (task: TaskFull, newStatus: TaskStatus) => {
    try {
      await updateTaskStatus(task.id, newStatus);
      if (taskForDetail && taskForDetail.id === task.id) {
        setTaskForDetail((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    } catch {
      // operatingError is handled by the useProjectTasks hook
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    await deleteTask(taskId);
    if (taskForDetail && taskForDetail.id === taskId) {
      setTaskForDetail(null);
    }
  };

  // Authorization: Creator or Workspace Owner can edit/delete/archive project
  const canManage = Boolean(user && project && (project.created_by === user.id || isOwner));

  // Authorization helper for task management (creator, assignee, project creator, or workspace owner)
  const canManageTask = (task: TaskFull) => {
    if (!user) return false;
    return (
      task.created_by === user.id ||
      task.assigned_to === user.id ||
      (project && project.created_by === user.id) ||
      isOwner
    );
  };

  // Filter tasks client-side
  const filteredTasks = tasks.filter((t) => {
    if (taskFilters.assignedToMe && user && t.assigned_to !== user.id) {
      return false;
    }
    if (taskFilters.status !== 'ALL' && t.status !== taskFilters.status) {
      return false;
    }
    if (taskFilters.priority !== 'ALL' && t.priority !== taskFilters.priority) {
      return false;
    }
    if (taskFilters.overdue) {
      if (t.status === 'DONE' || !t.due_date) return false;
      const info = getDueDateInfo(t.due_date);
      if (!info?.isOverdue) return false;
    }
    if (taskFilters.search.trim()) {
      const q = taskFilters.search.toLowerCase().trim();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q) || false;
      if (!matchTitle && !matchDesc) return false;
    }
    return true;
  });

  // Calculate task statistics for Overview
  const totalTasksCount = tasks.length;
  const openTasksCount = tasks.filter((t) => t.status !== 'DONE').length;
  const completedTasksCount = tasks.filter((t) => t.status === 'DONE').length;
  const overdueTasksCount = tasks.filter((t) => {
    if (t.status === 'DONE' || !t.due_date) return false;
    const info = getDueDateInfo(t.due_date);
    return Boolean(info?.isOverdue);
  }).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-32" />
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-8 text-center space-y-4">
        <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
        <h2 className="text-base font-semibold text-destructive">{error || 'Project not found'}</h2>
        <Button variant="outline" size="sm" onClick={() => navigate('/projects')}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          Back to Projects
        </Button>
      </div>
    );
  }

  const tabs: { id: ProjectTab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: Layers },
    { id: 'posts', label: 'Posts', icon: FileText },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'discussion', label: 'Discussion', icon: MessageSquare },
    { id: 'files', label: 'Files', icon: FolderArchive },
    { id: 'activity', label: 'Activity', icon: Activity },
  ];


  return (
    <div className="space-y-6">
      {/* Back Link */}
      <div>
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Projects
        </Link>
      </div>

      {/* Project Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-border/60 pb-6">
        <div className="space-y-2 max-w-2xl">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {project.name}
            </h1>
            <ProjectStatusBadge status={project.status} />
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            {project.description || 'No description provided for this project.'}
          </p>

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
            <div className="flex items-center gap-1.5">
              <Avatar
                size="xs"
                src={project.creator?.avatar_url}
                name={project.creator?.display_name || 'Creator'}
              />
              <span>
                Created by <strong className="text-foreground">{project.creator?.display_name || 'Collaborator'}</strong>
              </span>
            </div>

            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{formatDate(project.created_at)}</span>
            </div>

            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Updated {formatTimeAgo(project.updated_at)}</span>
            </div>
          </div>
        </div>

        {/* Actions (Creator or Owner) */}
        {canManage && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditOpen(true)}
              className="text-xs h-8"
            >
              <Edit2 className="h-3 w-3 mr-1" />
              Edit
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleArchive}
              className="text-xs h-8"
              title={project.status === 'ARCHIVED' ? 'Unarchive Project' : 'Archive Project'}
            >
              <Archive className="h-3 w-3 mr-1" />
              {project.status === 'ARCHIVED' ? 'Unarchive' : 'Archive'}
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsDeleteOpen(true)}
              className="text-xs h-8"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-border/60 overflow-x-auto pb-px">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                isActive
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
              {tab.id === 'posts' && posts.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/10 text-primary font-mono">
                  {posts.length}
                </span>
              )}
              {tab.id === 'tasks' && tasks.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 font-mono">
                  {tasks.length}
                </span>
              )}
              {tab.id === 'activity' && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 font-mono">
                  Live
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="pt-2">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Columns */}
            <div className="lg:col-span-2 space-y-6">
              {/* Project Description & Goals */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">About this Project</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-xs leading-relaxed text-muted-foreground">
                  <p className="text-foreground">
                    {project.description || 'No detailed description provided yet. Click "Edit" above to document this project\'s scope and goals.'}
                  </p>

                  <div className="p-3.5 rounded-lg border border-border/80 bg-muted/20 space-y-2">
                    <h4 className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                      <Layers className="h-3.5 w-3.5 text-primary" />
                      Project Roadmap
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      This project is currently in the <strong className="text-foreground font-mono">{project.status}</strong> stage. Team members can post engineering updates, ask questions, manage sprint tasks, and store build artifacts.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* REAL TASK SUMMARY & STATISTICS CARD */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-amber-400" />
                    Task Statistics
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab('tasks')}
                    className="text-xs h-7 text-primary hover:text-primary"
                  >
                    View Task Board →
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* Total Tasks */}
                    <div
                      onClick={() => {
                        setTaskFilters({ ...taskFilters, status: 'ALL' });
                        setActiveTab('tasks');
                      }}
                      className="p-3 rounded-lg border border-border/70 bg-card hover:bg-muted/30 cursor-pointer transition-colors space-y-1"
                    >
                      <span className="text-[11px] text-muted-foreground font-medium">Total</span>
                      <div className="text-xl font-bold font-mono text-foreground">
                        {totalTasksCount}
                      </div>
                      <span className="text-[10px] text-muted-foreground">All tasks recorded</span>
                    </div>

                    {/* Open Tasks */}
                    <div
                      onClick={() => {
                        setTaskFilters({ ...taskFilters, status: 'TODO' });
                        setActiveTab('tasks');
                      }}
                      className="p-3 rounded-lg border border-border/70 bg-card hover:bg-muted/30 cursor-pointer transition-colors space-y-1"
                    >
                      <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                        <Clock3 className="h-3 w-3 text-blue-400" /> Open
                      </span>
                      <div className="text-xl font-bold font-mono text-blue-400">
                        {openTasksCount}
                      </div>
                      <span className="text-[10px] text-muted-foreground">In backlog & active</span>
                    </div>

                    {/* Completed Tasks */}
                    <div
                      onClick={() => {
                        setTaskFilters({ ...taskFilters, status: 'DONE' });
                        setActiveTab('tasks');
                      }}
                      className="p-3 rounded-lg border border-border/70 bg-card hover:bg-muted/30 cursor-pointer transition-colors space-y-1"
                    >
                      <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Completed
                      </span>
                      <div className="text-xl font-bold font-mono text-emerald-400">
                        {completedTasksCount}
                      </div>
                      <span className="text-[10px] text-muted-foreground">Successfully closed</span>
                    </div>

                    {/* Overdue Tasks */}
                    <div
                      onClick={() => {
                        setActiveTab('tasks');
                      }}
                      className="p-3 rounded-lg border border-border/70 bg-card hover:bg-muted/30 cursor-pointer transition-colors space-y-1"
                    >
                      <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-red-400" /> Overdue
                      </span>
                      <div className={`text-xl font-bold font-mono ${overdueTasksCount > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                        {overdueTasksCount}
                      </div>
                      <span className="text-[10px] text-muted-foreground">Past deadline</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Statistics & Module Statuses */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Project Modules</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div
                    onClick={() => setActiveTab('posts')}
                    className="p-3 rounded-md border border-border/60 bg-muted/10 space-y-1 cursor-pointer hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                      <span className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-primary" />
                        Project Posts
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        Live
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Markdown updates, announcements, and threaded discussions.
                    </p>
                  </div>

                  <div
                    onClick={() => setActiveTab('tasks')}
                    className="p-3 rounded-md border border-border/60 bg-muted/10 space-y-1 cursor-pointer hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                      <span className="flex items-center gap-1.5">
                        <CheckSquare className="h-3.5 w-3.5 text-amber-400" />
                        Project Tasks
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        Live
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Interactive Kanban boards with statuses, assignees, and due dates.
                    </p>
                  </div>


                  <div
                    onClick={() => setActiveTab('discussion')}
                    className="p-3 rounded-md border border-border/60 bg-muted/10 space-y-1 cursor-pointer hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                      <span className="flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
                        Project Discussion
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        Live
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Scoped real-time channel dedicated to this project.
                    </p>
                  </div>

                  <div
                    onClick={() => setActiveTab('files')}
                    className="p-3 rounded-md border border-border/60 bg-muted/10 space-y-1 cursor-pointer hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                      <span className="flex items-center gap-1.5">
                        <FolderArchive className="h-3.5 w-3.5 text-sky-400" />
                        Private Files
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        Live
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Secure private uploads with signed URL downloads.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right 1 Column */}
            <div className="space-y-6">
              {/* Project Metadata */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Project Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Status</span>
                    <ProjectStatusBadge status={project.status} />
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Created</span>
                    <span className="font-mono text-foreground">{formatDate(project.created_at)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Last Updated</span>
                    <span className="font-mono text-foreground">{formatTimeAgo(project.updated_at)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Created By</span>
                    <span className="font-medium text-foreground">
                      {project.creator?.display_name || 'Collaborator'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Workspace Team Collaborators */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Team Collaborators
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          size="xs"
                          src={member.profile?.avatar_url}
                          name={member.profile?.display_name || 'Member'}
                        />
                        <div>
                          <div className="text-xs font-semibold text-foreground">
                            {member.profile?.display_name}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            @{member.profile?.username}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono uppercase text-muted-foreground">
                        {member.role}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* POSTS TAB (LIVE IN PHASE 3) */}
        {activeTab === 'posts' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Project Posts & Updates</h3>
                <p className="text-xs text-muted-foreground">
                  Structured technical updates, RFCs, and decision records with live threaded comments.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={loadPosts} className="text-xs h-8 text-muted-foreground">
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Refresh
                </Button>
                <Button size="sm" onClick={() => setIsCreatePostOpen(true)} className="text-xs h-8">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  New Post
                </Button>
              </div>
            </div>

            {postsError ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-6 text-center space-y-3">
                <AlertCircle className="h-6 w-6 text-destructive mx-auto" />
                <h4 className="text-xs font-semibold text-destructive">{postsError}</h4>
                <Button variant="outline" size="sm" onClick={loadPosts} className="text-xs">
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry
                </Button>
              </div>
            ) : loadingPosts ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="rounded-lg border border-border bg-card p-5 space-y-3">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-12 w-full" />
                    <div className="pt-2 border-t border-border flex justify-between">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : posts.length === 0 ? (
              <Card>
                <CardContent className="p-8">
                  <EmptyState
                    icon={FileText}
                    title="No posts yet"
                    description="Share an idea, update, decision, or technical note with your team."
                    actionLabel="Create Post"
                    onAction={() => setIsCreatePostOpen(true)}
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} projectId={project.id} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TASKS TAB (LIVE IN PHASE 4) */}
        {activeTab === 'tasks' && (
          <div className="space-y-4">
            {/* Header / Filter Toolbar */}
            <TaskFiltersBar
              filters={taskFilters}
              onChange={setTaskFilters}
              viewMode={taskViewMode}
              onViewModeChange={setTaskViewMode}
              onNewTask={() => {
                setCreateTaskDefaultStatus('TODO');
                setIsCreateTaskOpen(true);
              }}
            />

            {/* Operating Error Banner */}
            {operatingError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  <span className="text-xs text-destructive">{operatingError}</span>
                </div>
                <button
                  onClick={clearOperatingError}
                  className="text-xs text-destructive hover:text-foreground shrink-0"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Error state */}
            {tasksError ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-6 text-center space-y-3">
                <AlertCircle className="h-6 w-6 text-destructive mx-auto" />
                <h4 className="text-xs font-semibold text-destructive">{tasksError}</h4>
                <Button variant="outline" size="sm" onClick={refreshTasks} className="text-xs">
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry
                </Button>
              </div>
            ) : loadingTasks ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((col) => (
                  <div key={col} className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ))}
              </div>
            ) : tasks.length === 0 ? (
              <Card>
                <CardContent className="p-8">
                  <EmptyState
                    icon={CheckSquare}
                    title="No tasks yet"
                    description="Break this project into actionable work for your 3-person team."
                    actionLabel="Create Task"
                    onAction={() => {
                      setCreateTaskDefaultStatus('TODO');
                      setIsCreateTaskOpen(true);
                    }}
                  />
                </CardContent>
              </Card>
            ) : filteredTasks.length === 0 ? (
              <Card>
                <CardContent className="p-8">
                  <EmptyState
                    icon={CheckSquare}
                    title="No tasks match your filters"
                    description={
                      taskFilters.assignedToMe
                        ? "No tasks are currently assigned to you."
                        : "Try adjusting your search query, priority, or status filters."
                    }
                    actionLabel="Clear Filters"
onAction={() =>
                       setTaskFilters({
                         search: '',
                         status: 'ALL',
                         priority: 'ALL',
                         assignedToMe: false,
                         overdue: false,
                       })
                     }
                  />
                </CardContent>
              </Card>
            ) : taskViewMode === 'board' ? (
              <TaskBoard
                tasks={filteredTasks}
                members={members}
                canManageTask={canManageTask}
                onEdit={(task) => setTaskForEdit(task)}
                onDelete={(task) => setTaskForDelete(task)}
                onView={(task) => setTaskForDetail(task)}
                onStatusChange={handleStatusChange}
                onNewTaskWithStatus={(st) => {
                  setCreateTaskDefaultStatus(st);
                  setIsCreateTaskOpen(true);
                }}
              />
            ) : (
              <TaskList
                tasks={filteredTasks}
                members={members}
                canManageTask={canManageTask}
                onEdit={(task) => setTaskForEdit(task)}
                onDelete={(task) => setTaskForDelete(task)}
                onView={(task) => setTaskForDetail(task)}
                onStatusChange={handleStatusChange}
              />
            )}
          </div>
        )}

        {/* DISCUSSION TAB (LIVE PROJECT CHAT) */}
        {activeTab === 'discussion' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-emerald-400" />
                Project Discussion
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  Live
                </span>
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Real-time chat scoped to this project. Only project members can read or send messages here.
              </p>
            </div>

            <ChatPanel
              messages={chatMessages}
              loading={loadingChat}
              error={chatError}
              operatingError={chatOperatingError}
              onDismissOperatingError={clearChatOperatingError}
              onRefresh={refreshChat}
              onSend={sendChatMessage}
              onEdit={editChatMessage}
              onDelete={deleteChatMessage}
              emptyTitle="No discussion yet"
              emptyDescription="Kick off the project conversation — share context, ask questions, or mention a teammate with @."
              composerPlaceholder="Discuss this project... (Enter to send, Shift+Enter for a new line)"
            />
          </div>
        )}

        {/* FILES TAB (LIVE PRIVATE FILES) */}
        {activeTab === 'files' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FolderArchive className="h-4 w-4 text-sky-400" />
                Project Files
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  Live
                </span>
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Private files for this project. Only project members can view or download them.
              </p>
            </div>

            <ProjectFilePanel
              files={projectFiles}
              loading={loadingFiles}
              error={filesError}
              operatingError={filesOperatingError}
              uploading={uploadingFile}
              onDismissOperatingError={clearFilesOperatingError}
              onRefresh={refreshFiles}
              onUpload={uploadFile}
              onUploadFolder={uploadFolder}
              onDownload={getDownloadUrl}
              onDelete={deleteFile}
            />
          </div>
        )}

        {/* ACTIVITY TAB (LIVE TIMELINE) */}
        {activeTab === 'activity' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-400" />
                  Project Activity
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                    Live
                  </span>
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Chronological record of everything happening in this project.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshActivity}
                className="text-xs h-8 text-muted-foreground self-start sm:self-auto"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
              </Button>
            </div>

            <Card>
              <CardContent className="p-4">
                <ActivityFeed
                  events={activityEvents}
                  loading={loadingActivity}
                  error={activityError}
                  onRefresh={refreshActivity}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Edit Project Dialog */}
      <EditProjectDialog
        isOpen={isEditOpen}
        project={project}
        onClose={() => setIsEditOpen(false)}
        onSubmit={handleUpdate}
      />

      {/* Delete Project Dialog */}
      <DeleteProjectDialog
        isOpen={isDeleteOpen}
        projectName={project.name}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
      />

      {/* Create Post Dialog */}
      <CreatePostDialog
        isOpen={isCreatePostOpen}
        onClose={() => setIsCreatePostOpen(false)}
        onSubmit={handleCreatePost}
      />

      {/* Create Task Dialog */}
      <CreateTaskDialog
        isOpen={isCreateTaskOpen}
        onClose={() => setIsCreateTaskOpen(false)}
        onSubmit={handleCreateTask}
        members={members}
        defaultStatus={createTaskDefaultStatus}
      />

      {/* Edit Task Dialog */}
      <EditTaskDialog
        isOpen={Boolean(taskForEdit)}
        task={taskForEdit}
        onClose={() => setTaskForEdit(null)}
        onSubmit={handleUpdateTask}
        members={members}
      />

      {/* Delete Task Dialog */}
      <DeleteTaskDialog
        isOpen={Boolean(taskForDelete)}
        task={taskForDelete}
        onClose={() => setTaskForDelete(null)}
        onConfirm={handleDeleteTask}
      />

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        isOpen={Boolean(taskForDetail)}
        task={taskForDetail}
        onClose={() => setTaskForDetail(null)}
        onEdit={(task) => setTaskForEdit(task)}
        onDelete={(task) => setTaskForDelete(task)}
        onStatusChange={handleStatusChange}
        members={members}
        canManage={Boolean(taskForDetail && canManageTask(taskForDetail))}
      />
    </div>
  );
};

