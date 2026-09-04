import React from 'react';
import { Link } from 'react-router-dom';
import {
  FolderGit2,
  FileText,
  MessageSquare,
  CheckSquare,
  MessagesSquare,
  FolderArchive,
  Activity as ActivityIcon,
} from 'lucide-react';
import { ActivityEvent } from '@/types/activity';
import { Avatar } from '@/components/ui/Avatar';
import { buildDeepLink } from '@/lib/activityLinks';
import { describeActivity, activityExcerpt } from '@/lib/activityText';
import { formatTimeAgo } from '@/lib/utils';

const ENTITY_ICONS = {
  project: FolderGit2,
  post: FileText,
  comment: MessageSquare,
  task: CheckSquare,
  message: MessagesSquare,
  file: FolderArchive,
} as const;

export const ActivityItem: React.FC<{ event: ActivityEvent }> = ({ event }) => {
  const Icon = ENTITY_ICONS[event.entity_type] || ActivityIcon;
  const link = buildDeepLink(event);
  const excerpt = activityExcerpt(event);

  const body = (
    <div className="flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0">
      <Avatar
        size="xs"
        src={event.actor?.avatar_url}
        name={event.actor?.display_name || 'System'}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
          <p className="text-xs text-foreground leading-snug break-words">
            {describeActivity(event)}
          </p>
        </div>
        {excerpt && (
          <p className="text-[11px] text-muted-foreground italic truncate mt-0.5 pl-[18px]">
            “{excerpt}”
          </p>
        )}
        <div className="flex items-center gap-2 mt-1 pl-[18px]">
          <span className="font-mono text-[10px] text-muted-foreground">
            {formatTimeAgo(event.created_at)}
          </span>
          {event.project && (
            <span className="text-[10px] text-primary truncate max-w-[140px]">
              {event.project.name}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return link ? (
    <Link to={link} className="block rounded-md hover:bg-muted/30 px-2 -mx-2 transition-colors">
      {body}
    </Link>
  ) : (
    <div className="px-2 -mx-2">{body}</div>
  );
};
