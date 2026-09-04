import React from 'react';
import { WorkspaceMember } from '@/types/workspace';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

interface AssigneeSelectorProps {
  members: WorkspaceMember[];
  value: string | null;
  onChange: (userId: string | null) => void;
  disabled?: boolean;
  className?: string;
}

export const AssigneeSelector: React.FC<AssigneeSelectorProps> = ({
  members,
  value,
  onChange,
  disabled = false,
  className,
}) => {
  return (
    <select
      value={value ?? ''}
      aria-label="Assignee"
      onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
      disabled={disabled}
      className={cn(
        'w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground',
        'focus:outline-none focus:ring-2 focus:ring-primary/50',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
    >
      <option value="">Unassigned</option>
      {members.map((m) => (
        <option key={m.user_id} value={m.user_id}>
          {m.profile?.display_name ?? m.profile?.username ?? m.user_id}
        </option>
      ))}
    </select>
  );
};

// ── Compact assignee chip (read-only display) ──────────────────────────────

interface AssigneeChipProps {
  member: WorkspaceMember | undefined;
  size?: 'xs' | 'sm';
}

export const AssigneeChip: React.FC<AssigneeChipProps> = ({ member, size = 'xs' }) => {
  if (!member) {
    return <span className="text-[10px] text-muted-foreground italic">Unassigned</span>;
  }
  return (
    <span className="inline-flex items-center gap-1">
      <Avatar
        size={size}
        src={member.profile?.avatar_url}
        name={member.profile?.display_name}
      />
      <span className="text-[10px] text-muted-foreground">
        {member.profile?.display_name}
      </span>
    </span>
  );
};
