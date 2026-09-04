import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { PlusCircle, KeyRound, AlertCircle, ArrowRight, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';

export const OnboardingPage: React.FC = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const { currentWorkspace, createWorkspace, joinWorkspace, loading: wsLoading } = useWorkspace();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [workspaceName, setWorkspaceName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If not logged in, redirect to login
  if (!authLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  // If already has an active workspace, go straight to dashboard
  if (!authLoading && !wsLoading && currentWorkspace) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceName.trim()) {
      setErrorMessage('Please provide a name for your workspace.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      await createWorkspace(workspaceName.trim());
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create workspace.';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      setErrorMessage('Please enter an invite code.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      await joinWorkspace(inviteCode.trim());
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid or expired invite code.';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome to DevRoom, {profile?.display_name || 'Developer'}!
          </h1>
          <p className="text-xs text-muted-foreground">
            To begin collaborating, create your team&apos;s workspace or join an existing one.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-card border border-border rounded-lg">
          <button
            type="button"
            onClick={() => {
              setMode('create');
              setErrorMessage(null);
            }}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded text-xs font-medium transition-colors ${
              mode === 'create'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <PlusCircle className="h-4 w-4" />
            Create Workspace
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('join');
              setErrorMessage(null);
            }}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded text-xs font-medium transition-colors ${
              mode === 'join'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <KeyRound className="h-4 w-4" />
            Join with Invite Code
          </button>
        </div>

        {/* Main Card */}
        <Card className="border-border bg-card shadow-xl">
          {errorMessage && (
            <div className="m-5 mb-0 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {mode === 'create' ? (
            <form onSubmit={handleCreate}>
              <CardHeader>
                <CardTitle className="text-base">Create Team Workspace</CardTitle>
                <CardDescription>
                  You will become the workspace owner and can invite up to 2 other developers (3 members total).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Workspace Name"
                  placeholder="e.g. Core Engineering, Nebula Labs"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  required
                  autoFocus
                />

                <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <Users className="h-3.5 w-3.5 text-primary" />
                    3-Member Team Limit
                  </div>
                  <p>
                    DevRoom enforces a strict 3-member limit for focused collaboration. You can invite your 2 teammates once created.
                  </p>
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full" isLoading={submitting}>
                  Create Workspace
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </CardFooter>
            </form>
          ) : (
            <form onSubmit={handleJoin}>
              <CardHeader>
                <CardTitle className="text-base">Join with Invite Code</CardTitle>
                <CardDescription>
                  Enter the 8-character invite code provided by your workspace owner.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Workspace Invite Code"
                  placeholder="e.g. 7a8f9c1b"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="font-mono uppercase tracking-widest text-center text-base"
                  maxLength={16}
                  required
                  autoFocus
                />

                <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    Membership is verified and secured by PostgreSQL Row Level Security. You will immediately gain access to your team&apos;s projects and discussions.
                  </span>
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full" isLoading={submitting}>
                  Join Workspace
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
};
