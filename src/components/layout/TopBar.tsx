import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  Search,
  Bell,
  LogOut,
  User as UserIcon,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useNotifications } from '@/hooks/useNotifications';
import { SearchPalette } from '@/components/search/SearchPalette';
import { useToast } from '@/hooks/useToast';
import { logger } from '@/lib/logger';
import { Avatar } from '@/components/ui/Avatar';

interface TopBarProps {
  onOpenSidebar: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onOpenSidebar }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { toastError } = useToast();
  const { currentWorkspace } = useWorkspace();
  const { unreadCount } = useNotifications();
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Global Ctrl+K / Cmd+K opens the command palette from anywhere
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Get friendly title from pathname
  const getPageTitle = (path: string): string => {
    if (path.startsWith('/dashboard')) return 'Dashboard';
    if (path.startsWith('/chat')) return 'Team Chat';
    if (path.startsWith('/projects')) return 'Projects';
    if (path.startsWith('/tasks')) return 'Tasks';
    if (path.startsWith('/members')) return 'Team Members';
    if (path.startsWith('/notifications')) return 'Notifications';
    if (path.startsWith('/settings')) return 'Workspace Settings';
    return 'DevRoom';
  };

  const pageTitle = getPageTitle(location.pathname);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (err) {
      logger.error('Failed to sign out', { error: err instanceof Error ? err.message : 'unknown' });
      toastError('Could not sign you out. Please try again.');
    }
  };

  return (
    <>
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md">
      {/* Left: Mobile trigger & Page Title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="rounded p-1.5 text-muted-foreground hover:bg-muted md:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          {pageTitle}
        </h2>
      </div>

      {/* Right: Search, Notifications, Profile */}
      <div className="flex items-center gap-2.5">
        {/* Global Search trigger (Ctrl+K ready) */}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label="Search workspace"
          className="flex sm:hidden rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Search className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="hidden sm:flex items-center gap-2 h-8 px-2.5 rounded-md border border-input bg-card text-xs text-muted-foreground hover:border-border transition-colors w-52"
        >
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="flex-1 text-left truncate">Search DevRoom...</span>
          <kbd className="pointer-events-none inline-flex h-4 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
            Ctrl+K
          </kbd>
        </button>

        {/* Notifications Icon Button */}
        <button
          type="button"
          onClick={() => navigate('/notifications')}
          className="relative rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
          aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications, none unread'}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-mono font-semibold flex items-center justify-center ring-2 ring-background">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* User Profile dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 rounded-md p-1 hover:bg-muted/60 transition-colors focus:outline-none"
          >
            <Avatar
              size="sm"
              src={profile?.avatar_url}
              name={profile?.display_name || user?.email || 'Dev'}
            />
            <div className="hidden lg:flex flex-col text-left">
              <span className="text-xs font-medium text-foreground leading-tight">
                {profile?.display_name || 'Developer'}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono leading-tight">
                @{profile?.username || 'user'}
              </span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden lg:block" />
          </button>

          {profileOpen && (
            <div
              className="absolute right-0 mt-1 w-52 rounded-md border border-border bg-card p-1 shadow-lg z-50 animate-in fade-in"
              onClick={() => setProfileOpen(false)}
            >
              <div className="px-2 py-1.5 border-b border-border mb-1">
                <div className="text-xs font-semibold text-foreground">
                  {profile?.display_name || 'Developer'}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono truncate">
                  {user?.email}
                </div>
              </div>

              <button
                onClick={() => navigate('/settings')}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded"
              >
                <UserIcon className="h-3.5 w-3.5" />
                Profile & Settings
              </button>

              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded mt-0.5"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>

      <SearchPalette
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        workspaceId={currentWorkspace?.id}
        workspaceName={currentWorkspace?.name}
      />
    </>
  );
};
