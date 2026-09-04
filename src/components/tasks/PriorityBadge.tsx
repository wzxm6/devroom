import React from 'react';
import { cn } from '@/lib/utils';
import { TaskPriority } from '@/types/task';
import { PRIORITY_CONFIG } from '@/lib/taskUtils';

interface PriorityBadgeProps {
  priority: TaskPriority;
  className?: string;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, className }) => {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border',
        cfg.className,
        className
      )}
      aria-label={`Priority: ${cfg.label}`}
    >
      <span aria-hidden="true">{cfg.icon}</span>
      {cfg.label}
    </span>
  );
};
