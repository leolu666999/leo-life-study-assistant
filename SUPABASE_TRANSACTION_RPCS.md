# Supabase Transaction RPCs

Updated: 2026-07-12

## Result

Phase 4.5 adds 7 PostgreSQL transaction functions through 2 versioned
migrations. The second migration is a compatibility correction for zero-value
progress updates; it replaces one function without adding another public API.

| Function | Atomic tables | Repository callers |
| --- | --- | --- |
| `save_task_with_relations` | tasks, subtasks, tags, task_tags, tasks/progress_items pin state | Task create, update, status transitions, task-backed progress create/update |
| `add_task_progress_entry_atomic` | task_progress_entries, tasks | Task progress history update |
| `pin_progress_item_atomic` | tasks, progress_items | Bottom progress pin selection |
| `save_plan_with_relations` | plans, generated tasks/tags/task_tags, plan_items, journal_entries | Plan create and update |
| `delete_plan_with_journal` | journal_entries, plans and database cascades | Plan delete |
| `save_todo_list_with_items` | todo_lists, todo_list_items | To Do list create and whole-list update |
| `save_expense_with_currency` | expenses, settings | Expense create/update and `lastUsedCurrency` |

## Security model

- All functions are `security invoker` with `search_path = public, pg_temp`.
- Ownership is derived only from `auth.uid()`.
- No function accepts `user_id` from a body, query, header, or RPC argument.
- Anonymous execute permission is revoked; only `authenticated` receives the
  required execute grants.
- RLS remains active inside every function.
- Owner-aware composite foreign keys continue to reject cross-user links.
- The Admin Account has no special behavior in these ordinary RPCs and can only
  access its own business rows.

## Repository compatibility

The Supabase repositories now send one prepared payload to the appropriate RPC
and then use their existing read mapper. API routes, status codes, and response
JSON shapes are unchanged. To Do schedule parsing remains in TypeScript before
the transaction call. SQLite repositories were not changed.

## Deliberately not converted

Single-row Settings writes, completion toggles, standalone Journal writes,
reads, searches, and deletes already covered by one PostgreSQL statement and
its foreign-key cascades remain direct repository operations. RPC conversion
would not improve their consistency.

## Migrations

- `202607120001_phase45_transaction_rpcs.sql`: creates and grants the 7
  transaction functions.
- `202607120002_phase45_progress_status_compatibility.sql`: preserves the
  existing rule that a zero progress update does not move a Task from
  `not_started` to `in_progress`.

Both migrations are present locally and applied to the linked isolated Sydney
Supabase test project. They do not contain data migration statements.

## Known limits

- Cloud offline replay still returns 409.
- Course, timetable, Storage, and local real-data migration remain out of scope.
- Transactions cover one online PostgreSQL request; they do not create a
  distributed transaction with external services.
