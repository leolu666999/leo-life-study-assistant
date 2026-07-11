# Supabase Transaction Audit

Updated: 2026-07-12

## Scope and safety boundary

This audit covers the Phase 4 Supabase repositories for Settings, Tasks, To Do,
Plans, Journal, and Finance. It does not change SQLite, uploads, API paths,
response shapes, courses, timetable data, or real user data.

The transaction owner is always `auth.uid()`. No transaction function accepts a
caller supplied `user_id`.

## Summary

The audit found 11 multi-table business write flows. They can be covered by 7
transaction functions without converting every repository operation to RPC.

| Priority | Business flow | Current writes | Current risk | Decision |
| --- | --- | --- | --- | --- |
| P0 | Create Task | tasks, subtasks, tags, task_tags; optional task/progress unpin | A task can survive failed relation writes | Strong transaction |
| P0 | Update Task/status | tasks, subtasks, tags, task_tags; optional task/progress unpin | Old subtasks/tags can be removed before replacements fail | Strong transaction |
| P0 | Add Task progress entry | task_progress_entries, tasks | Entry and current value can diverge | Strong transaction |
| P0 | Pin progress item | tasks, progress_items | More than one item can remain pinned after partial failure | Strong transaction |
| P0 | Create Plan | plans, plan item tasks, tags, task_tags, plan_items, journal_entries | Half-created plan graph and reflection | Strong transaction |
| P0 | Update Plan | plans, plan item tasks, tags, task_tags, plan_items, journal_entries | Existing links/reflection can be lost before replacement succeeds | Strong transaction |
| P0 | Delete Plan | journal_entries, plans and database cascades | Journal removal can succeed while plan deletion fails | Strong transaction |
| P1 | Create To Do list | todo_lists, todo_list_items | Empty list can remain after item failure | Strong transaction |
| P1 | Replace To Do list/items | todo_lists, todo_list_items | Existing items can be deleted before replacement succeeds | Strong transaction |
| P1 | Create Expense and remember currency | expenses, settings | Expense can save while next default currency remains stale | Transactional for deterministic product behavior |
| P1 | Update Expense and remember currency | expenses, settings | Updated currency and remembered currency can diverge | Transactional for deterministic product behavior |

## Current independent-request sequences

### Task repository

`createTask` currently inserts `tasks`, optionally unpins `tasks` and
`progress_items`, then independently rebuilds `task_tags`, creates missing
`tags`, and inserts `subtasks`. `updateTask` updates the parent first and then
deletes/rebuilds tags and subtasks. A failure after any completed request leaves
partial state.

Progress updates independently insert `task_progress_entries` and update the
parent task. Pinning independently updates `tasks` and legacy `progress_items`.

### Plan repository

Plan create/update writes the `plans` row, creates plan-item Tasks (which each
have their own tag writes), replaces `plan_items`, and replaces the linked daily
`journal_entries` reflection. These requests currently cross both repository
and table boundaries without one database transaction.

Plan deletion removes the linked journal row before deleting the plan.

### To Do repository

Creating or replacing a list writes `todo_lists`, then inserts or replaces
`todo_list_items`. Natural-language schedule parsing happens in TypeScript and
should remain there; only the prepared rows need an atomic database write.

### Finance repository

Creating/updating an expense and persisting `settings.lastUsedCurrency` are two
independent requests. A stale remembered currency would not corrupt the expense,
but it would violate the documented rule that the next form uses the currency
from the last successful save. A small two-table transaction is justified.

## Single-table or already atomic operations

The following operations do not need additional transaction functions:

- Settings reads and single-key upserts.
- Task, expense, journal, and To Do reads.
- Single-row completion toggles that issue one SQL statement.
- Standalone journal entry create/update/delete.
- Single-row Task or Expense delete where PostgreSQL foreign-key cascades run in
  the same statement transaction.
- Pure searches, filters, and list queries.

Converting these operations to RPC would add maintenance and permission surface
without improving consistency.

## Required transaction functions

| Function | Covers |
| --- | --- |
| `save_task_with_relations` | Task create/update/status, subtasks, tags, task_tags, pin state |
| `add_task_progress_entry_atomic` | Progress history insert and Task current-value update |
| `pin_progress_item_atomic` | Exclusive pin across Task and legacy progress rows |
| `save_plan_with_relations` | Plan create/update, plan-item Tasks, links, daily journal reflection |
| `delete_plan_with_journal` | Plan and linked journal deletion |
| `save_todo_list_with_items` | To Do list create/update and complete item replacement |
| `save_expense_with_currency` | Expense create/update and last-used currency setting |

## Permission model

- Functions use `security invoker` and a fixed `search_path`.
- Every function fails when `auth.uid()` is null.
- Owner identity comes exclusively from `auth.uid()`.
- Existing RLS remains enabled and effective inside the functions.
- Existing owner-aware composite foreign keys continue to reject cross-user
  relations even if a foreign UUID is guessed.
- `anon` receives no execute permission; `authenticated` receives only the
  minimum execute grants for these business functions.
- The Admin Account uses these functions as an ordinary user and therefore can
  only mutate its own data. Cross-user administration remains restricted to
  separately protected `/api/admin/*` server paths.

## Failure and rollback expectations

Failure injection must cover parent creation followed by invalid child data,
subtask and tag relation failures, cross-owner relations, invalid progress,
duplicate UUIDs, Plan create/update failures, and To Do item failures. Each test
must verify both the returned error and the database state: parent counts,
relation counts, original rows, and absence of orphans.

## Out of scope and known limits

- Course, timetable, Storage, real SQLite data, and real uploads are untouched.
- Offline cloud replay continues to return 409.
- TypeScript still performs To Do schedule parsing before calling the RPC.
- The RPC boundary protects one online request; it does not add distributed
  transactions across offline queues or external services.
