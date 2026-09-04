import React from 'react';
import { ProjectStatus } from '@/types/project';
import { cn } from '@/lib/utils';

interface ProjectStatusBadgeProps {
  status: ProjectStatus;
  className?: string;
}

export const ProjectStatusBadge: React.FC<ProjectStatusBadgeProps> = ({ status, className }) => {
  const styles: Record<ProjectStatus, string> = {
    PLANNING: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    PAUSED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    COMPLETED: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    ARCHIVED: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  };

  const labels: Record<ProjectStatus, string> = {
    PLANNING: 'Planning',
    ACTIVE: 'Active',
    PAUSED: 'Paused',
    COMPLETED: 'Completed',
    ARCHIVED: 'Archived',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase font-mono border transition-colors',
        styles[status] || styles.PLANNING,
        className
      )}
    >
      {labels[status] || status}
    </span>
  );
};
