import React, { useState } from 'react';
import { Users, Copy, Check, Shield, User, Calendar, KeyRound } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { formatDate } from '@/lib/utils';

export const MembersPage: React.FC = () => {
  const { user } = useAuth();
  const { currentWorkspace, members, memberCount, maxMembers } = useWorkspace();
  const [copiedCode, setCopiedCode] = useState(false);

  const copyInviteCode = () => {
    if (currentWorkspace?.invite_code) {
      navigator.clipboard.writeText(currentWorkspace.invite_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Team Members
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            DevRoom is strictly configured for exactly 3 collaborators in the MVP.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={memberCount >= maxMembers ? 'warning' : 'success'} className="px-3 py-1 text-xs">
            {memberCount} / {maxMembers} Members
          </Badge>
        </div>
      </div>

      {/* Invite Code Banner */}
      {currentWorkspace?.invite_code && (
        <Card className="border-border/80 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              Workspace Invite Code
            </CardTitle>
            <CardDescription>
              Share this code with your teammates so they can join this workspace during onboarding.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 bg-muted/60 border border-border px-3.5 py-2 rounded-md font-mono text-sm font-semibold tracking-wider text-foreground">
              {currentWorkspace.invite_code}
            </div>
            <Button variant="outline" size="sm" onClick={copyInviteCode} className="h-9">
              {copiedCode ? (
                <>
                  <Check className="h-4 w-4 mr-1.5 text-emerald-400" />
                  Copied to Clipboard
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1.5" />
                  Copy Invite Code
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Member Roster */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Active Collaborators</CardTitle>
          <CardDescription>
            All members with access to projects, discussions, tasks, and private files.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border/60">
          {members.map((member) => (
            <div key={member.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar
                  size="md"
                  src={member.profile?.avatar_url}
                  name={member.profile?.display_name || 'Member'}
                />
                <div>
                  <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    {member.profile?.display_name || 'Developer'}
                    {member.user_id === user?.id && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20">
                        You
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    @{member.profile?.username || 'user'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Joined {formatDate(member.joined_at)}</span>
                </div>

                <Badge variant={member.role === 'owner' ? 'default' : 'secondary'} className="text-xs">
                  {member.role === 'owner' ? (
                    <span className="flex items-center gap-1">
                      <Shield className="h-3 w-3" /> Owner
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" /> Member
                    </span>
                  )}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
