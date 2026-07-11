# Cloud Data Isolation Test Results

Date: 2026-07-12

## Remote Repository tests

| Wave | Tests | Result |
| --- | ---: | --- |
| Settings | 5 | Passed |
| Tasks/Progress/Subtasks | 14 | Passed |
| To Do | 7 | Passed |
| Plans/Journal | 8 | Passed |
| Expenses | 8 | Passed |
| Total | 42 | Passed |

## Verified boundaries

- User A can CRUD its own core data.
- User B cannot read, update, delete, complete, link to, or guess User A data.
- Rejected writes are checked with the service-role test client and leave database state unchanged.
- Cross-user Subtask, Task/Tag, To Do parent, Journal/Plan, and Expense/Receipt relations are rejected by PostgreSQL.
- Admin Account sees only Admin-owned rows through ordinary APIs.
- Client-supplied `user_id`, query values, and headers cannot replace the verified Session user.
- Journal response tests search for both User A's ID and private content; neither appears for User B or Admin ordinary APIs.
- AUD, USD, and CNY remain separate record currencies and last-used currency is owner-scoped.
- To Do Sydney wall times survive PostgreSQL timestamptz round trips without a two-hour/day shift.

## Test isolation and cleanup

Tests use only User A, User B, and the isolated Admin Account. Synthetic business rows and uploaded-file metadata are deleted before and after the suite. Profiles and the four default Settings rows per account are retained and restored. No Storage object or real local file is uploaded.

## Remaining risks

1. Multi-table PostgREST mutations need a PostgreSQL RPC/transaction boundary before production use.
2. Course/timetable timezone mapping needs a dedicated wave.
3. Storage metadata and object operations need transactional reconciliation and signed URLs.
4. Cloud offline replay remains disabled until a persistent idempotency ledger exists.
5. Reliable password-email delivery still requires custom SMTP.
