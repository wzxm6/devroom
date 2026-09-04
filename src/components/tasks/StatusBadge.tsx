import React from 'react';
import { cn } from '@/lib/utils';
import { TaskStatus } from '@/types/task';
import { STATUS_CONFIG } from '@/lib/taskUtils';

interface StatusBadgeProps {
  status: TaskStatus;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        'inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border',
        cfg.className,
        className
      )}
    >
      {cfg.label}
    </span>
  );
};
