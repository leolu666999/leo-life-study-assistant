# Public URL E2E Test Results

Status: pending Vercel authentication and test URL creation.

The public E2E run will use only the isolated test Supabase project, test Auth accounts, synthetic tasks/To Do/plans/journals/expenses/ICS, and small generated PDF/PNG files. It will not use or migrate the real SQLite database, real timetable, journal, expenses, Important Files, or local uploads.

Required result groups:

- Auth: register, login, persisted refresh, logout, forgot/reset, callback.
- Settings: update and persist `homeTitle`.
- Tasks: create, edit, complete, archive, restore, delete.
- To Do: list/item creation, completion, natural-language schedule parsing.
- Plan/Journal: create, view, edit where supported by the existing API.
- Expenses: multi-currency creation and `lastUsedCurrency` persistence.
- Timetable: query, ICS preview/confirm, recurrence, edit/cancel occurrence.
- Files: synthetic upload, Important File CRUD, synthetic receipt, signed URL, binary proxy, deletion.
- Isolation: User B and ordinary Admin APIs cannot see User A data.
- PWA: manifest, icons, service worker registration, API/Auth non-caching.

No test is marked passed until the deployed HTTPS URL and resulting database/object state are checked.
