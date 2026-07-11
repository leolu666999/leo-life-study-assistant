# Supabase Phase 4 Repositories

## Scope

Phase 4 adds cloud data access for the five approved waves without changing the default local-first backend. No real SQLite row or local upload is migrated.

## Runtime modes

| Mode | Configuration | Repository | Auth | Data source |
| --- | --- | --- | --- | --- |
| Local | `DATA_BACKEND=sqlite`, `AUTH_REQUIRED=false` | SQLite implementations | Optional/off | Existing SQLite and uploads |
| Cloud | `DATA_BACKEND=supabase`, `AUTH_REQUIRED=true` | Supabase implementations | Required | PostgreSQL through the authenticated session |

`DATA_BACKEND=supabase` without Auth fails closed. Unknown backends fail closed. Cloud mode cannot call `getDb()`, cannot run legacy data copying, and cannot select a SQLite-only Repository.

## Trusted identity flow

```text
Route Handler
  -> repositoryContextForRequest(request)
  -> Supabase verifies bearer or SSR-cookie session
  -> { userId: verifiedUser.id, supabase: authenticatedClient }
  -> Service
  -> Supabase Repository
  -> PostgreSQL RLS + owner-aware foreign keys
```

Request bodies, query parameters, `x-user-id`, email, localStorage, and client-supplied owner fields are ignored. Ordinary repositories use the publishable key plus the user's access token; they never use the service-role key.

## Implemented repositories

1. `supabase-settings-repository.ts`
2. `supabase-task-repository.ts`
3. `supabase-todo-repository.ts`
4. `supabase-plan-repository.ts`
5. `supabase-journal-repository.ts`
6. `supabase-finance-repository.ts`

The existing interfaces and Service layer remain in use. Interface results may be synchronous for SQLite or asynchronous for Supabase; Route Handlers await both without changing JSON response shapes.

## Business behavior

- Settings keep per-user title, visibility, background, and last-used currency rows.
- Tasks include Task, Deadline, Counter, Checklist, tags, subtasks, progress history, archive/restore, and pinning.
- To Do remains separate from Task. Natural-language schedule parsing is reused, and PostgreSQL timestamps map back to Australia/Sydney wall time.
- Plans preserve task links and daily reflection behavior.
- Journal content remains private and linked-plan foreign keys are owner-aware.
- Expenses preserve numeric amounts, 21 currencies, per-record currency, and last-used currency updates. Receipt metadata is optional.

## Deferred modules

Timetable/courses, uploaded files, important files, and real Storage remain SQLite-only. Cloud calls to these repositories are rejected; no local fallback is allowed. Local JSON backup export returns `409` in Cloud mode. Cloud offline replay returns `409` until an idempotent `sync_operations` ledger exists.

## Next stage

The next recommended task is the Timetable/Course Repository, with explicit Australia/Sydney timestamp tests. Storage should follow as a separate stage with private buckets and signed URLs.

Before production traffic, multi-table mutations such as Task plus tags/subtasks and Plan plus items/reflection should move behind PostgreSQL functions or another transactional boundary. The current authenticated PostgREST sequence is safe from cross-user access but can leave partial owner-scoped state if a later request fails.
