# DevRoom — Private Team Collaboration Platform

DevRoom is a focused, high-performance private collaboration web application engineered for a small team of 3 developers. It combines the immediacy of Discord (real-time chat & discussions), the focus of GitHub Issues/Linear (tasks & kanban), the clarity of Notion (markdown posts & updates), and secure private storage.

---

## Implementation Status

* ✅ **Phase 1 — Foundation**: auth, workspaces, 3-member limit, RLS, app shell
* ✅ **Phase 2 — Projects**: project CRUD, directory, detail page, status system, RLS
* ✅ **Phase 3 — Posts + Comments**: markdown posts, threaded comments, realtime, optimistic updates
* ✅ **Phase 4 — Tasks + Kanban**: task CRUD, assignment, priorities, due dates, Kanban board with drag-and-drop, list view, filters/search, global `/tasks` page, realtime + optimistic status changes
* ✅ **Phase 5 — Chat**: global workspace chat + per-project discussion, realtime INSERT/UPDATE/DELETE, optimistic sending with rollback, own-message edit, soft-delete, @mention highlighting
* ✅ **Phase 6 — Files**: private per-project storage (private bucket, signed-URL downloads, uploader/owner delete, single-file + folder upload with structure encoding)
* ✅ **Phase 7 — Activity + Notifications**: server-generated activity timeline (triggers, append-only), per-recipient notifications with realtime badge, read/unread state, deep links
* ✅ **Phase 8 — Global Search**: `Ctrl+K` command palette over projects, posts, tasks, and files (Postgres FTS, workspace-scoped, RLS-enforced)
* ✅ **Phase 9 — Dashboard Truth + UX Consolidation**: fully data-driven dashboard and project cards, stale-label sweep
* 🛡️ **Phase 10 — Production Readiness**: RLS audit + hardening migration, Vitest suite, error boundary, toasts, code splitting, docs (staging verification still required — see Production status)

---

## Tech Stack

* **Frontend**: React 18, TypeScript (Strict), Vite, Tailwind CSS, Lucide React icons, dnd-kit (Kanban drag-and-drop), date-fns, marked + DOMPurify (Markdown rendering)
* **Backend & Database**: Supabase (PostgreSQL with Row Level Security, Supabase Auth, Supabase Realtime, Supabase Storage)
* **Deployment**: Vercel-ready static SPA with client-side routing
* **Package Manager**: npm

---

## Security Architecture

1. **Row Level Security (RLS)**: Mandatory on all tables. Users can only read, write, and interact with data inside workspaces they belong to. Cross-workspace data leakage is strictly blocked at the database engine level.
2. **Strict 3-Member Limit**: Enforced via PostgreSQL trigger (`trg_enforce_workspace_member_limit`) on `workspace_members` to guarantee concurrency safety.
3. **No Secret Leaks**: The frontend ONLY communicates through the public anon key (`VITE_SUPABASE_ANON_KEY`). The `SUPABASE_SERVICE_ROLE_KEY` is never referenced or exposed in client code.
4. **Isolated Storage**: Project files live in a private Supabase Storage bucket (`project-files`, never public, 50 MB server-side object cap) with Storage RLS mirroring the database scope model. Downloads use short-lived signed URLs; permanent public URLs are never created. Metadata in `project_files` carries its own RLS plus a scope-validation trigger.

---

## Local Setup & Development

### 1. Prerequisites
* Node.js v18+ (tested on Node v24)
* npm
* A free [Supabase](https://supabase.com) project

### 2. Clone & Install Dependencies
```bash
git clone <your-repo-url>
cd chat
npm install
```

### 3. Configure Supabase Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in your Supabase project URL and anon public key from your Supabase Dashboard (**Project Settings -> API**):
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

### 4. Apply Database Migrations
Go to your **Supabase Dashboard -> SQL Editor**, and execute the migration files in order:
```
1. supabase/migrations/20260904000000_devroom_foundation.sql
2. supabase/migrations/20260904010000_devroom_projects.sql
3. supabase/migrations/20260904020000_devroom_posts.sql
4. supabase/migrations/20260904030000_devroom_tasks.sql
5. supabase/migrations/20260904050000_devroom_chat.sql
6. supabase/migrations/20260904060000_devroom_files.sql
7. supabase/migrations/20260904070000_devroom_activity.sql
8. supabase/migrations/20260904080000_devroom_search.sql
9. supabase/migrations/20260904100000_rls_hardening.sql
10. supabase/migrations/20260904110000_fix_activity_triggers.sql
11. supabase/migrations/20260904110001_fix_activity_cascade_nulls.sql
```
These migrations create:
* `profiles` (linked to `auth.users`)
* `workspaces` (with unique invite code generation)
* `workspace_members` (with 3-member enforcement trigger and RLS)
* `projects` (with status constraints, indexes, and member/owner RLS)
* `posts` & `post_comments` (with parent_id threading, automatic updated_at triggers, Realtime publication, and DOMPurify sanitized markdown)
* `tasks` (with TODO/IN_PROGRESS/DONE statuses, priorities, assignees, due dates, assignee-membership validation trigger, updated_at triggers, RLS, and Realtime publication)
* `chat_messages` (global workspace chat via `project_id IS NULL` plus project-scoped discussion, scope-validation trigger, RLS, Realtime publication)
* `project_files` metadata + private `project-files` Storage bucket (50 MB object cap, scope-validation trigger, database + Storage RLS, metadata-only Realtime publication)
* `activity_events` (append-only, server-generated via triggers, member-read-only RLS) + `notifications` (per-recipient, realtime publication, read state via guarded RPCs)
* Full-text search vectors (`search_vector` + GIN indexes on projects, posts, tasks, project filenames — authorization unchanged, existing table RLS applies)
* Hardening (`20260904100000`): owner-only workspace member adds, immutable project workspace
* Staging trigger fixes (`20260904110000`, `20260904110001`): mention-regex capture indexing, cascade-safe activity DELETE branches
* Membership helper functions (`is_workspace_member`, `is_workspace_owner`, `is_project_member`, `is_post_member`, `is_task_accessible`, `is_workspace_member_of_project`, `is_chat_message_accessible`, `is_project_file_accessible`, `storage_path_workspace_id`, `is_storage_path_workspace_member`), event emitters (`emit_activity`, `notify_user`, `notify_mentioned_users`), read-state RPCs (`mark_notification_read`, `mark_all_notifications_read`), and `join_workspace_by_invite` RPC


### 5. Start the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure

```
chat/
├── .env.example                   # Template for Supabase environment variables
├── .gitignore                     # Git ignore rules protecting credentials
├── index.html                     # HTML root with dark theme configuration
├── package.json                   # Dependencies and build scripts
├── postcss.config.js              # PostCSS configuration
├── tailwind.config.js             # Tailwind CSS theme tokens & dark palette
├── tsconfig.json                  # Strict TypeScript configuration
├── vite.config.ts                 # Vite bundler configuration
│
├── supabase/
│   └── migrations/                # Timestamped SQL migrations (apply in order)
│       ├── 20260904000000_devroom_foundation.sql  # Profiles, workspaces, members, 3-member limit, RLS
│       ├── 20260904010000_devroom_projects.sql    # Projects table, indexes, RLS
│       ├── 20260904020000_devroom_posts.sql       # Posts, threaded comments, triggers, RLS, Realtime
│       ├── 20260904030000_devroom_tasks.sql       # Tasks, Kanban statuses, assignee validation, RLS, Realtime
│       ├── 20260904050000_devroom_chat.sql         # Chat messages table, scope validation, RLS, Realtime
│       ├── 20260904060000_devroom_files.sql        # Project files metadata, private bucket, DB + Storage RLS
│       ├── 20260904070000_devroom_activity.sql     # Activity events + notifications, server triggers, RLS, Realtime
│       ├── 20260904080000_devroom_search.sql       # FTS vectors + GIN indexes (no auth changes)
│       ├── 20260904100000_rls_hardening.sql        # Corrective: owner-only member adds, immutable project workspace
│       ├── 20260904110000_fix_activity_triggers.sql # Staging fix: mention regex + cascade-safe deletes
│       └── 20260904110001_fix_activity_cascade_nulls.sql # Staging fix: skip child events when scope is torn down
│   └── tests/                       # Staging RLS negative-test SQL (run in SQL Editor)
│       └── rls_negative_tests.sql
│
├── src/
    ├── main.tsx                   # React root mount
    ├── App.tsx                    # Top-level Router & Context Providers
    ├── index.css                  # Global Tailwind styles & dark mode tokens
    │
    ├── types/                     # TypeScript definitions
    │   ├── database.ts            # Supabase database schema types
    │   ├── auth.ts                # Auth & Profile models
    │   ├── workspace.ts           # Workspace & Membership models
    │   ├── project.ts             # Project models
    │   ├── post.ts                # Post & Comment models
    │   ├── task.ts                # Task models, statuses, priorities, filters
    │   ├── chat.ts                # Chat message models and constraints
    │   ├── projectFile.ts         # Project file models, size/type limits
    │   ├── activity.ts            # Activity event models
    │   ├── notification.ts        # Notification models and labels
    │   └── search.ts              # Search result models and limits
    │
    ├── lib/                       # Utilities & client wrappers
    │   ├── utils.ts               # Class merger & date formatting
    │   ├── logger.ts              # Centralized client logging (single reporter hook point)
    │   ├── taskUtils.ts           # Due-date helpers, priority/status configs
    │   ├── fileUtils.ts           # File size formatting, name sanitization, validation, folder-path encoding
    │   ├── activityLinks.ts       # Deep-link resolution for activity/notifications
    │   ├── activityText.ts        # Human phrasing for activity events
    │   └── supabase/
    │       ├── config.ts          # Environment validator
    │       └── client.ts          # Initialized Supabase client
    │
    ├── services/                  # Supabase query layer
    │   ├── authService.ts         # Sign in, Sign up, Session listener
    │   ├── profileService.ts      # Profile fetch & update
    │   ├── workspaceService.ts    # Workspaces, members, and invite join
    │   ├── projectService.ts      # Project CRUD
    │   ├── postService.ts         # Post CRUD
    │   ├── commentService.ts      # Threaded comment CRUD + tree builder
    │   ├── taskService.ts         # Task CRUD, status changes, workspace tasks
    │   ├── chatService.ts         # Workspace/project message CRUD (RLS is the auth boundary)
    │   ├── projectFileService.ts  # File upload/download/delete + metadata (RLS is the auth boundary)
    │   ├── activityService.ts     # Activity reads (append-only, server-generated)
    │   ├── notificationService.ts # Notification reads + read-state RPCs
    │   └── searchService.ts       # Workspace-scoped FTS (RLS is the auth boundary)
    │
    ├── context/                   # Global React contexts
    │   ├── AuthContext.tsx        # Persistent user session
    │   └── WorkspaceContext.tsx   # Active workspace & member tracking
    │
    ├── hooks/                     # Custom ergonomic hooks
    │   ├── useAuth.ts
    │   ├── useWorkspace.ts
    │   ├── useProjects.ts
    │   ├── useProjectTasks.ts     # Project tasks with Realtime + optimistic updates
    │   ├── useWorkspaceChat.ts    # Global chat with Realtime + optimistic sending
    │   ├── useProjectChat.ts      # Project discussion with Realtime + optimistic sending
    │   ├── useProjectFiles.ts     # Project files with single/folder upload, delete, error states
    │   ├── useActivityFeed.ts     # Workspace/project activity (poll-based)
    │   ├── useNotifications.ts    # Notifications with realtime badge + read state
    │   ├── useGlobalSearch.ts     # Debounced workspace search with cancellation
    │   └── useToast.ts            # Global toast dispatcher
    │
    ├── components/
    │   ├── SetupRequired.tsx      # Clear visual setup screen when .env is unconfigured
    │   ├── ErrorBoundary.tsx      # Last-resort render-crash fallback
    │   ├── ui/                    # Reusable UI primitives
    │   │   ├── Button.tsx
    │   │   ├── Input.tsx
    │   │   ├── Card.tsx
    │   │   ├── Badge.tsx
    │   │   ├── Avatar.tsx
    │   │   ├── Dialog.tsx
    │   │   ├── EmptyState.tsx
    │   │   ├── LoadingSkeleton.tsx
    │   │   ├── Toast.tsx            # Global toast provider + viewport
    │   │   └── toastContext.ts      # Toast context definition
    │   ├── projects/              # Project cards and dialogs
    │   ├── posts/                 # Markdown editor/renderer, post cards, comments
    │   ├── tasks/                 # Kanban board, list, cards, filters, dialogs
    │   ├── chat/                  # Chat panel, message list/item, composer, mentions
    │   ├── files/                 # File panel, list/item, single + folder upload buttons, folder grouping
    │   ├── activity/              # Activity feed and human-readable items
    │   ├── search/                # Global search command palette
    │   └── layout/                # Shell layout
    │       ├── Sidebar.tsx        # Collapsible responsive sidebar
    │       ├── TopBar.tsx         # Search, notifications, user menu
    │       └── AppLayout.tsx      # Main application shell with auth guards
    │
    └── pages/                     # Feature pages
        ├── auth/
        │   ├── LoginPage.tsx      # Sign in page
        │   └── RegisterPage.tsx   # Account registration
        ├── workspace/
        │   └── OnboardingPage.tsx # Create workspace or join via invite code
        ├── dashboard/
        │   └── DashboardPage.tsx  # Live metrics, recent projects/tasks, team roster
        ├── chat/
        │   └── ChatPage.tsx       # Global workspace chat (live, realtime)
        ├── projects/
        │   ├── ProjectsPage.tsx       # Projects directory with status filters
        │   └── ProjectDetailPage.tsx  # Overview, posts, tasks Kanban, live discussion, live files, live activity
        ├── posts/
        │   └── PostDetailPage.tsx # Markdown post with live threaded comments
        ├── tasks/
        │   └── TasksPage.tsx      # Global workspace Kanban board + list, filters, search
        ├── members/
        │   └── MembersPage.tsx    # Member roster & invite code manager
        ├── notifications/
        │   └── NotificationsPage.tsx # Live notification center with realtime badge, read state, deep links
        └── settings/
            └── SettingsPage.tsx   # Profile & workspace settings
│
├── tests/
│   └── e2e/critical-path.spec.ts # Playwright critical path (staging-gated, self-skips)
│
├── docs/
│   ├── SECURITY.md              # RLS matrix, audit findings, negative-test guide
│   └── OPERATIONS.md            # Staging, deployment, backup/recovery, logging
│
├── playwright.config.ts         # E2E runner config (browsers installed separately)
```

---

## Testing

```bash
npm run test        # Vitest unit suite (37 tests: utils, links, offline service guards)
npx tsc --noEmit    # Strict typecheck (also covers test files under src/)
npm run lint        # ESLint
npm run build       # Production build
```

Unit tests live next to their modules (`*.test.ts`) and cover date/task
helpers, file validation/sanitization plus folder-path encoding round-trips,
activity phrasing and deep links, and deterministic offline service guards
(37 tests). Hook/component behavior is covered by
architecture convention (optimistic update + rollback + realtime dedup shared
patterns) and left for a future testing-library pass. The Playwright
critical-path spec (`tests/e2e/critical-path.spec.ts`) requires a staging
environment (see `playwright.config.ts`) and self-skips without one; browsers
are not installed by `npm install` (`npx playwright install chromium`).

## Production status

DevRoom 1.0 is code-complete through Phase 10 hardening, with `tsc`, `lint`,
`build`, and 37 unit tests green. It has been verified against a real staging
Supabase project with an authenticated session: 21/21 single-user checks pass
(auth, workspace/project/post/comment/task/chat/file CRUD, realtime delivery,
RLS negatives, storage security, activity, search). Two staging defects found
this way (activity-trigger `lower(text[])` failure and cascade FK aborts) are
fixed, live-applied, and committed. Still pending a second login and a browser
environment: two-user realtime observation, cross-user notification receipt,
member-vs-nonmember reads, and the Playwright E2E run. Full details:
`docs/SECURITY.md`, `docs/OPERATIONS.md`.

---

## Production Build & Vercel Deployment

To test a production build locally:
```bash
npm run build
npm run preview
```

### Deploying to Vercel
1. Push this repository to GitHub or GitLab.
2. Import the repository into [Vercel](https://vercel.com).
3. Under **Project Settings -> Environment Variables**, add:
   * `VITE_SUPABASE_URL`
   * `VITE_SUPABASE_ANON_KEY`
4. Deploy! Vercel automatically detects the Vite build output (`dist/`).
