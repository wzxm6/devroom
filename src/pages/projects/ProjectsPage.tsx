import React, { useState, useEffect, useMemo } from 'react';
import { FolderGit2, Plus, RefreshCw, AlertCircle, Filter } from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { useWorkspace } from '@/hooks/useWorkspace';
import { taskService } from '@/services/taskService';
import { ProjectStatus } from '@/types/project';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { CreateProjectDialog } from '@/components/projects/CreateProjectDialog';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';

export const ProjectsPage: React.FC = () => {
  const { projects, loading, error, refreshProjects, createProject } = useProjects();
  const { currentWorkspace } = useWorkspace();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | ProjectStatus>('ALL');

  // Real per-project open-task counts from ONE workspace-scoped fetch (no
  // N+1 per-card queries). Null while unavailable so cards hide the row
  // instead of showing fake zeros.
  const [openTaskCounts, setOpenTaskCounts] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    if (!currentWorkspace) {
      setOpenTaskCounts(null);
      return;
    }
    let cancelled = false;
    taskService
      .getWorkspaceTasks(currentWorkspace.id)
      .then((tasks) => {
        if (cancelled) return;
        const counts: Record<string, number> = {};
        tasks.forEach((t) => {
          if (t.status !== 'DONE') counts[t.project_id] = (counts[t.project_id] ?? 0) + 1;
        });
        setOpenTaskCounts(counts);
      })
      .catch(() => {
        if (!cancelled) setOpenTaskCounts(null);
      });
    return () => {
      cancelled = true;
    };
  }, [currentWorkspace]);

  const filteredProjects = useMemo(() => {
    if (statusFilter === 'ALL') return projects;
    return projects.filter((p) => p.status === statusFilter);
  }, [projects, statusFilter]);

  const filterOptions: { label: string; value: 'ALL' | ProjectStatus }[] = [
    { label: 'All Projects', value: 'ALL' },
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Planning', value: 'PLANNING' },
    { label: 'Paused', value: 'PAUSED' },
    { label: 'Completed', value: 'COMPLETED' },
    { label: 'Archived', value: 'ARCHIVED' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FolderGit2 className="h-5 w-5 text-primary" />
            Projects
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Build, track, and collaborate on your team&apos;s projects.
          </p>
        </div>

        <Button onClick={() => setIsCreateOpen(true)} size="sm" className="text-xs">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New Project
        </Button>
      </div>

      {/* Filter Tabs & Count */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Filter className="h-3.5 w-3.5 text-muted-foreground mr-1 hidden sm:block shrink-0" />
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                statusFilter === opt.value
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              }`}
            >
              {opt.label}
              {opt.value !== 'ALL' && (
                <span className="ml-1.5 font-mono text-[10px] opacity-70">
                  {projects.filter((p) => p.status === opt.value).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="text-xs text-muted-foreground font-mono">
          Showing {filteredProjects.length} of {projects.length} project(s)
        </div>
      </div>

      {/* Main Content Area */}
      {error ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-6 text-center space-y-3">
          <AlertCircle className="h-6 w-6 text-destructive mx-auto" />
          <h3 className="text-sm font-semibold text-destructive">Unable to load projects</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">{error}</p>
          <Button variant="outline" size="sm" onClick={refreshProjects} className="text-xs">
            <RefreshCw className="h-3 w-3 mr-1.5" />
            Retry
          </Button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="rounded-lg border border-border bg-card p-5 space-y-4">
              <div className="flex justify-between items-center">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
              <Skeleton className="h-10 w-full" />
              <div className="pt-2 border-t border-border flex justify-between items-center">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderGit2}
          title="No projects yet"
          description="Create your first project to start collaborating with your team."
          actionLabel="Create Project"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon={FolderGit2}
          title="No matching projects"
          description={`There are no projects with status "${statusFilter}".`}
          actionLabel="View All Projects"
          onAction={() => setStatusFilter('ALL')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              openTaskCount={openTaskCounts ? (openTaskCounts[project.id] ?? 0) : undefined}
            />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <CreateProjectDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={async (input) => {
          await createProject(input);
        }}
      />
    </div>
  );
};
