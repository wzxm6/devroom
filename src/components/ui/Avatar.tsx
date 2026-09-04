import React from 'react';
import { cn } from '@/lib/utils';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = 'Avatar',
  name,
  size = 'md',
  className,
  ...props
}) => {
  const [imageError, setImageError] = React.useState(false);

  const getInitials = (text?: string): string => {
    if (!text) return '?';
    const parts = text.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return text.substring(0, 2).toUpperCase();
  };

  const sizes = {
    xs: 'h-6 w-6 text-[10px]',
    sm: 'h-7 w-7 text-xs',
    md: 'h-8 w-8 text-xs',
    lg: 'h-10 w-10 text-sm',
  };

  const initials = getInitials(name || alt);

  // Generate consistent color from name
  const getColorFromName = (str: string) => {
    const colors = [
      'bg-indigo-600/20 text-indigo-300 border-indigo-500/30',
      'bg-emerald-600/20 text-emerald-300 border-emerald-500/30',
      'bg-amber-600/20 text-amber-300 border-amber-500/30',
      'bg-sky-600/20 text-sky-300 border-sky-500/30',
      'bg-violet-600/20 text-violet-300 border-violet-500/30',
      'bg-rose-600/20 text-rose-300 border-rose-500/30',
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const colorStyle = getColorFromName(name || 'DevRoom');

  return (
    <div
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-md border font-mono font-medium overflow-hidden select-none',
        sizes[size],
        !src || imageError ? colorStyle : 'border-border bg-muted',
        className
      )}
      {...props}
    >
      {src && !imageError ? (
        <img
          src={src}
          alt={alt}
          onError={() => setImageError(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
};
