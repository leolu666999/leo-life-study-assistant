# Transaction Failure Test Results

Updated: 2026-07-12

## Outcome

- Remote transaction tests: **13/13 passed**
- Failure-injection tests: **12**
- Compatibility success tests: **1**
- Partial states observed: **0**
- Unauthorized cross-user successes: **0**
- Rejected writes that changed the database: **0**

## Failure injection coverage

1. Task create with duplicate Subtask UUID.
2. Task create with a failing tag payload.
3. Task create with an existing Task UUID.
4. Task update after old Subtasks are removed but replacement fails.
5. Progress history UUID conflict before parent progress update.
6. Plan create attempting to link another user's Task.
7. Plan create with a generated Task UUID conflict.
8. Plan update failing after parent/link/journal work has started.
9. To Do create with duplicate item UUID.
10. To Do update failing during item replacement.
11. Expense create using another user's receipt metadata.
12. Anonymous transaction RPC execution.

Every failure assertion checks the remote database through the isolated test
service client. Parent counts, relation counts, original values, and orphan
absence are verified in addition to the RPC error.

The thirteenth test confirms that a successful zero-value progress update keeps
the Task status at `not_started`, matching the pre-transaction API behavior.

## Full regression matrix

| Suite | Result |
| --- | --- |
| Local API/RLS/Auth/timezone tests | 112/112 |
| Remote Repository tests | 42/42 |
| Remote transaction tests | 13/13 |
| Remote Auth tests | 20/20 |
| Remote RLS/Admin/Storage tests | 36/36 |
| Total | **223/223** |

One initial Auth run encountered the isolated project's email-send rate limit;
the returned public error was confirmed as HTTP 429 and the complete Auth suite
then passed. It was unrelated to repository or transaction behavior.

## Build and data protection

- TypeScript typecheck: passed.
- Supabase cloud-mode clean production build: passed.
- Default SQLite-mode clean production build: passed.
- Client artifacts scanned: 76; secret/admin value hits: 0; sensitive-name hits: 0.
- Migration preflight: 21 SQLite tables, 282 rows, 4 files.
- Real SQLite, WAL, SHM, backup, and upload hashes: unchanged.
- Repository-local ignored SQLite/upload hashes: unchanged.
- Remote synthetic business rows after cleanup: 0.
- Real rows migrated: 0.
- Real files uploaded: 0.

The build still reports the existing Supabase Edge Runtime compatibility
warning, but compilation, type validation, static generation, and standalone
preparation complete successfully.
