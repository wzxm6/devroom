# DevRoom Security Model (audited Phase 10)

The frontend uses ONLY the Supabase anon key. All authorization is enforced
by Postgres Row Level Security, Storage policies, CHECK constraints, and
triggers. There is no service-role usage anywhere in client code.

## Per-table RLS matrix (`authenticated` role)

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| profiles | anyone authenticated | own row only | own row only (id pinned) | — (none) |
| workspaces | member or owner | `owner_id = auth.uid()` | owner only (owner_id pinned) | owner only |
| workspace_members | self or fellow member | **owner only** (Phase 10 hardening; joins go through the invite RPC) | — (none; roles immutable) | self or owner |
| projects | member or owner of workspace | member/owner + `created_by = self` | creator or owner (workspace pinned) | creator or owner |
| posts | project member | member + `author_id = self` | author only (author pinned) | author or workspace owner |
| post_comments | post member | member + `author_id = self` | author only (author pinned) | author or workspace owner |
| tasks | project member | member + `created_by = self` + assignee-in-workspace | creator/assignee/owner (author + scope re-checked) | creator or workspace owner |
| chat_messages | scope member (global: workspace; project: project) | self + scope membership + workspace/project match | author only (scope + author re-checked; scope immutable via trigger) | author or workspace owner |
| project_files | project member | member + `uploaded_by = self` + workspace match | — (none; no metadata editing) | uploader or workspace owner |
| activity_events | workspace member/owner | — (server triggers only) | — | — |
| notifications | `recipient_id = self` | — (server triggers only) | — (read flips via guarded RPCs) | — |

Spoofing answers: `workspace_id` cannot be forged (membership-checked on
every write, plus scope triggers for tasks/chat/files and an immutability
trigger for projects); `author_id`/`uploaded_by`/`created_by` are pinned to
`auth.uid()` on every write path; `recipient_id`/`actor_id` are never
client-writable (no policies at all).

## Storage (`project-files` bucket, private)

`public = false` enforced in migration (including `ON CONFLICT` repair) plus
a 50 MB server-side `file_size_limit`. Object policies: SELECT by workspace
path membership (path guessing denied), INSERT by membership with an exact
4-segment shape, DELETE by row-uploader-or-workspace-owner, and NO UPDATE
policy (objects can never be overwritten). Downloads use 60-second signed
URLs; public URLs are never created.

## Functions, RPCs, triggers

All helpers are `SECURITY DEFINER` but strictly read-only except the event
emitters (`emit_activity`, `notify_user`, `notify_mentioned_users`), the
join RPC, and the read-state RPCs — each guards on `auth.uid()` or derives
recipients from content + membership server-side. Activity/notification
triggers bypass client RLS by design (there are no client write policies to
bypass). Advisory: functions do not set an explicit `search_path`; all table
references are schema-qualified and no client role has DDL, so residual risk
is negligible — revisit if Supabase flags it.

## Search & realtime safety

Full-text search adds generated columns/indexes only; every search query
runs authenticated through the table policies above, so snippets can only
come from rows the caller could already read. Realtime channels are
per-scope (`project-tasks-{id}`, `project-chat-{id}`, …) or per-user
(`user-notifications-{uid}`); the workspace chat channel additionally
filters `project_id IS NULL` client-side because NULL filters are not
supported server-side. Every subscription removes its channel on unmount /
scope change (5 sites audited, all paired).

## Phase 10 audit findings (fixed)

1. **workspace_members self-join without invite code** — direct INSERTs now
   owner-only (`20260904100000_rls_hardening.sql`); joins flow through the
   code-checking RPC.
2. **projects.workspace_id mutable** — immutability trigger added; no UI or
   service ever moves projects.

## Negative testing

Runnable script: `supabase/tests/rls_negative_tests.sql` (impersonation via
JWT claims + `SET ROLE authenticated`, 15 checks: cross-workspace reads for
all 7 data domains, write/spoof/move/self-join/forge attempts, edit scoping).
Status: NOT EXECUTED — requires staging credentials. Attach output before
calling 1.0 done.
