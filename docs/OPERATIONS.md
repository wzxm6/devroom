# DevRoom Operations (staging, deployment, recovery, logging)

## Environments

| Concern | Staging | Production |
|---|---|---|
| Supabase project | dedicated staging project | dedicated production project |
| Vercel project | preview deployments | production deployment |
| Env vars | staging anon URL/key | production anon URL/key |
| Data | throwaway fixtures + test users | real team data |

Only two frontend variables exist (`VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`). Never add the service-role key to the client.

## Migrations

Apply in numeric order via Dashboard → SQL Editor (or Supabase CLI
`db push` if the project is linked):

```
20260904000000_devroom_foundation.sql
20260904010000_devroom_projects.sql
20260904020000_devroom_posts.sql
20260904030000_devroom_tasks.sql
20260904050000_devroom_chat.sql
20260904060000_devroom_files.sql
20260904070000_devroom_activity.sql
20260904080000_devroom_search.sql
20260904100000_rls_hardening.sql
```

`CREATE POLICY` has no existence guard (repo convention since Phase 1), so
migrations apply cleanly once, in order, on a fresh project — they are NOT
re-runnable. Never edit a shipped migration; add a corrective migration
instead (as `20260904100000` did). After applying, run
`supabase/tests/rls_negative_tests.sql` and confirm ALL PASS.

## Deploy (Vercel)

Build command: `npm run build` (runs `tsc && vite build`). Output: `dist/`.
Set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in Project Settings →
Environment Variables (separate values per environment). SPA routing needs
the standard Vite rewrite (`/*` → `/index.html`); `npm run preview`
validates the production bundle locally.

Rollback: redeploy the previous Vercel deployment (instant). Database
migrations are forward-only — rolling back code never rolls back schema, so
keep migrations additive and backward-compatible within a release.

## Backup & recovery

- **Database:** rely on Supabase automated backups + Point-In-Time Recovery
  (paid tiers; on free tier, take a manual backup via Dashboard → Database →
  Backups before any migration run). Recovery = restore to a new project,
  re-point env vars, redeploy.
- **Storage (`project-files`):** objects are NOT covered by database PITR.
  Periodically export critical files or mirror the bucket; recovery =
  re-upload + re-insert metadata rows (paths are deterministic:
  `<workspace>/<project>/<file-id>/<name>`).
- **Recovery drill:** new Supabase project → apply migrations in order →
  run RLS tests → restore data → set Vercel env vars → deploy → run the
  post-deployment checks below.

## Logging & observability

Client logging is centralized in `src/lib/logger.ts`. Console output is a
development diagnostic; to add production reporting, implement delivery
inside `logger.report()` (Sentry or equivalent) without touching call sites.
Fatal render crashes are caught by `ErrorBoundary` (logged with component
stack) and toasts cover failures with no page-level banner. Server-side,
review Supabase Dashboard → Logs (Postgres + Auth) after deploys and when
investigating RLS denials or trigger errors.

## Post-deployment verification

1. `npm run build` green from a clean checkout.
2. Migrations applied in order; RLS script ALL PASS.
3. Login → workspace → project → post/comment → task/Kanban → chat →
   file upload/download → activity visible → notification received →
   global search returns scoped results.
4. Cross-workspace spot check with a second user.
5. Vite chunk warning is advisory only; confirm route chunks load on
   first navigation (lazy routes: chat, tasks, project/post detail).
