# Supabase Repository Progress

## Completed waves

| Wave | Tables | API status |
| --- | --- | --- |
| 1 Settings | `settings` | Complete |
| 2 Tasks | `tasks`, `subtasks`, `tags`, `task_tags`, `task_progress_entries`, `progress_items` | Complete |
| 3 To Do | `todo_lists`, `todo_list_items` | Complete |
| 4 Plans/Journal | `plans`, `plan_items`, `journal_entries` | Complete |
| 5 Expenses | `expenses`, optional `uploaded_files` relation | Complete for metadata; Storage deferred |

## Cloud-enabled API methods

- `GET/PATCH /api/settings`
- `GET/POST /api/tasks`
- `PATCH/DELETE /api/tasks/[id]`
- `POST /api/tasks/[id]/complete`
- `POST /api/tasks/[id]/archive`
- `POST /api/tasks/[id]/restore`
- `GET/POST /api/tasks/[id]/progress-entries`
- `PATCH /api/subtasks/[id]`
- `GET/POST /api/progress`
- `PATCH /api/progress/[id]`
- `POST /api/progress/[id]/pin`
- `GET /api/archive`
- `GET/POST /api/todo-lists`
- `PATCH /api/todo-lists/[id]`
- `PATCH /api/todo-list-items/[id]`
- `GET/POST /api/plans`
- `PATCH/DELETE /api/plans/[id]`
- `GET/POST /api/journal`
- `GET/POST /api/expenses`
- `PATCH/DELETE /api/expenses/[id]`

Total: 31 HTTP method contracts across the core modules.

## SQLite-only or deferred

- Courses and timetable import/occurrence APIs
- Upload/download APIs
- Important-file APIs
- Real receipt and important-file Storage objects
- Local backup export in Cloud mode
- IndexedDB offline replay in Cloud mode

## Safety state

- Default backend remains SQLite.
- Cloud requires Auth and verified Session context.
- Admin Account ordinary APIs remain owner-scoped.
- Service role is limited to controlled Admin APIs and test cleanup.
- Real SQLite/uploads were not used by remote Repository tests.
- No migration was added in Phase 4 core because Phase 2 schema and RLS already cover these tables.
