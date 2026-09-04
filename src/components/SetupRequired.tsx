import React from 'react';
import { Database, KeyRound, Terminal, ExternalLink, ShieldCheck } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';

export const SetupRequired: React.FC = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-xl space-y-6">
        <div className="flex items-center space-x-3 text-left">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              DevRoom
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-mono font-normal">
                Setup Required
              </span>
            </h1>
            <p className="text-xs text-muted-foreground">
              Private team collaboration platform for a 3-person team
            </p>
          </div>
        </div>

        <Card className="border-border/80 bg-card/60 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-amber-400" />
              Supabase Configuration Missing
            </CardTitle>
            <CardDescription>
              DevRoom connects directly to your Supabase project with PostgreSQL, Auth, Realtime, and Storage.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                1. In your local project directory, create or edit <code className="text-primary font-mono bg-muted/60 px-1.5 py-0.5 rounded">.env.local</code>:
              </p>
              <div className="rounded-md bg-muted/90 p-3 font-mono text-xs border border-border text-foreground space-y-1">
                <div className="text-muted-foreground"># .env.local</div>
                <div>VITE_SUPABASE_URL=https://your-project-ref.supabase.co</div>
                <div>VITE_SUPABASE_ANON_KEY=your-supabase-anon-key</div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                2. Run <strong className="text-foreground">all</strong> SQL migrations{' '}
                <strong className="text-foreground">in order</strong> in your Supabase SQL Editor:
              </p>
              <div className="rounded border border-border bg-muted/60 p-2.5 font-mono text-[11px] text-foreground space-y-1 max-h-40 overflow-y-auto">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Terminal className="h-3.5 w-3.5 shrink-0" />
                  <span>supabase/migrations/</span>
                </div>
                {[
                  '20260904000000_devroom_foundation.sql',
                  '20260904010000_devroom_projects.sql',
                  '20260904020000_devroom_posts.sql',
                  '20260904030000_devroom_tasks.sql',
                  '20260904050000_devroom_chat.sql',
                  '20260904060000_devroom_files.sql',
                  '20260904070000_devroom_activity.sql',
                  '20260904080000_devroom_search.sql',
                  '20260904100000_rls_hardening.sql',
                ].map((file, i) => (
                  <div key={file} className="flex items-center gap-1.5 pl-5">
                    <span className="text-muted-foreground">{i + 1}.</span>
                    <span className="truncate">{file}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md bg-indigo-500/10 border border-indigo-500/20 p-3 text-xs text-indigo-300 flex items-start gap-2.5">
              <ShieldCheck className="h-4 w-4 shrink-0 text-indigo-400 mt-0.5" />
              <div>
                <strong>Security Architecture:</strong> Client code only receives the public anon key. All private workspace data and the 3-member limit are strictly enforced by PostgreSQL Row Level Security (RLS) and database triggers.
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>Restart the Vite dev server after updating <code className="text-foreground">.env.local</code>.</span>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
              >
                Supabase Dashboard
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
