import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  FolderGit2,
  CheckSquare,
  Users,
  Bell,
  Settings,
  Code2,
  X,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Badge } from '@/components/ui/Badge';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { currentWorkspace, memberCount, maxMembers, userWorkspaces, switchWorkspace } = useWorkspace();
  const [showWsMenu, setShowWsMenu] = React.useState(false);

  const mainNav = [
    { name: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
    { name: 'Chat', to: '/chat', icon: MessageSquare },
    { name: 'Projects', to: '/projects', icon: FolderGit2 },
    { name: 'Tasks', to: '/tasks', icon: CheckSquare },
  ];

  const teamNav = [
    { name: 'Members', to: '/members', icon: Users },
  ];

  const systemNav = [
    { name: 'Notifications', to: '/notifications', icon: Bell },
    { name: 'Settings', to: '/settings', icon: Settings },
  ];

  const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-md transition-colors',
      isActive
        ? 'bg-primary/10 text-primary font-semibold border-l-2 border-primary'
        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
    );

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card/95 backdrop-blur-md transition-transform duration-200 md:static md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header / Brand */}
        <div className="flex h-14 items-center justify-between px-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold shadow-sm">
              <Code2 className="h-4 w-4" />
            </div>
            <span className="font-bold tracking-tight text-sm text-foreground">DevRoom</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">v0.1</span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:text-foreground md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Workspace Selector */}
        <div className="p-3 border-b border-border/60 relative">
          <button
            type="button"
            onClick={() => setShowWsMenu(!showWsMenu)}
            className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted/60 transition-colors border border-border/50 text-left bg-background/50"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider">
                Workspace
              </div>
              <div className="text-xs font-semibold text-foreground truncate">
                {currentWorkspace?.name || 'No Workspace'}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 ml-2">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {memberCount}/{maxMembers}
              </Badge>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </button>

          {/* Workspace dropdown */}
          {showWsMenu && userWorkspaces.length > 1 && (
            <div className="absolute top-full left-3 right-3 mt-1 bg-card border border-border rounded-md shadow-xl py-1 z-30">
              <div className="px-2 py-1 text-[10px] text-muted-foreground uppercase font-mono">
                Switch Workspace
              </div>
              {userWorkspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => {
                    switchWorkspace(ws.id);
                    setShowWsMenu(false);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-xs hover:bg-muted/60 flex items-center justify-between',
                    ws.id === currentWorkspace?.id && 'text-primary font-medium'
                  )}
                >
                  <span className="truncate">{ws.name}</span>
                  {ws.id === currentWorkspace?.id && <span className="text-[10px] text-primary">Active</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* Main Workspace Section */}
          <div className="space-y-1">
            <div className="px-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
              Workspace
            </div>
            {mainNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => onClose()}
                className={navLinkClasses}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            ))}
          </div>

          {/* Team Section */}
          <div className="space-y-1">
            <div className="px-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
              Team
            </div>
            {teamNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => onClose()}
                className={navLinkClasses}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            ))}
          </div>

          {/* System Section */}
          <div className="space-y-1">
            <div className="px-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
              System
            </div>
            {systemNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => onClose()}
                className={navLinkClasses}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            ))}
          </div>
        </div>

        {/* Footer info: 3-member team notice */}
        <div className="p-3 border-t border-border bg-card/40">
          <div className="rounded-md border border-border/60 bg-muted/30 p-2.5 text-[11px] text-muted-foreground flex items-center justify-between">
            <span>Team Limit</span>
            <span className="font-mono text-foreground font-semibold">3 Members Max</span>
          </div>
        </div>
      </aside>
    </>
  );
};
