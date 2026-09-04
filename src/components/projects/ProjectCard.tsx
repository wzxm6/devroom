import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, CheckSquare, Clock } from 'lucide-react';
import { Project } from '@/types/project';
import { ProjectStatusBadge } from './ProjectStatusBadge';
import { Avatar } from '@/components/ui/Avatar';
import { formatDate, formatTimeAgo } from '@/lib/utils';

interface ProjectCardProps {
  project: Project;
  /**
   * Real count of open (non-DONE) tasks. Undefined while the count is
   * unavailable — the row is hidden rather than showing a fake zero.
   */
  openTaskCount?: number;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, openTaskCount }) => {
  return (
    <Link
      to={`/projects/${project.id}`}
      className="group block rounded-lg border border-border bg-card p-5 transition-all hover:border-primary/50 hover:shadow-md hover:shadow-primary/5 relative"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors truncate">
          {project.name}
        </h3>
        <ProjectStatusBadge status={project.status} />
      </div>

      <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem] mb-4">
        {project.description || 'No description provided.'}
      </p>

      {openTaskCount !== undefined && (
        <div className="flex items-center gap-1.5 py-2 border-y border-border/50 text-[11px] text-muted-foreground font-mono mb-4">
          <CheckSquare className="h-3.5 w-3.5 text-amber-400" />
          <span>
            {openTaskCount} open task{openTaskCount === 1 ? '' : 's'}
          </span>
        </div>
      )}

      {/* Footer: Creator & Timestamp */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Avatar
            size="xs"
            src={project.creator?.avatar_url}
            name={project.creator?.display_name || 'Creator'}
          />
          <span className="truncate max-w-[120px]">
            {project.creator?.display_name || 'Collaborator'}
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1" title={`Created ${formatDate(project.created_at)}`}>
            <Calendar className="h-3 w-3" />
            {formatDate(project.created_at)}
          </span>
          <span className="hidden sm:flex items-center gap-1 text-muted-foreground/70" title={`Updated ${formatDate(project.updated_at)}`}>
            <Clock className="h-3 w-3" />
            {formatTimeAgo(project.updated_at)}
          </span>
        </div>
      </div>
    </Link>
  );
};
