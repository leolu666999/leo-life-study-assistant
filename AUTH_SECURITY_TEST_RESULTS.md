# Phase 3 Auth Security Test Results

Date: 2026-07-11

## Automated coverage

| Suite | Tests | Result |
| --- | ---: | --- |
| Existing API contract tests | 42 | Passed |
| PostgreSQL/RLS local harness | 43 | Passed |
| Auth data-mode guard | 9 | Passed |
| Runtime and redirect boundary | 10 | Passed |
| Real temporary SQLite isolation | 2 | Passed |
| Real remote Supabase Auth | 20 | Passed |
| Real remote RLS/Admin/Storage validation | 36 | Passed |

## Verified security outcomes

- Auth disabled preserves local access without a login redirect.
- Auth enabled with real Application Support paths fails before SQLite opens.
- A compliant Auth test starts only a new temporary SQLite with zero tasks and an empty uploads directory.
- Anonymous private pages redirect to login; anonymous private APIs return `401`.
- Personal Account receives `403` from protected Admin APIs.
- Admin Account reaches protected Admin APIs, while ordinary Supabase queries remain constrained by RLS.
- Query parameters and headers cannot replace the authenticated user identity.
- SSR cookies restore the same account in a fresh server client and are cleared on local sign-out.
- Registration creates one Auth user, duplicate registration creates no second row, and the signup trigger creates one profile plus four default settings.
- Real recovery-token verification and password update succeed.
- No authorization bypass succeeded and no rejected write changed protected remote data.

## Data-integrity verification

The pre-Phase-3 SHA-256 baseline covers the real SQLite database, WAL, SHM, backup, four uploads, and repository-local ignored data. The main database, backup, all four uploads, and repository-local ignored files retained identical hashes. The live WAL/SHM hashes changed when the default local server was stopped and restarted; these are volatile SQLite runtime files and were not copied into Auth tests. A before/after read-only preflight produced the same semantic digest, the same 21 tables, 282 rows, four files, database size, and database mtime. Test fixtures are created under the system temporary directory and removed after each run.

## Residual risks

1. Custom SMTP is required before production password-email testing and launch.
2. Phase 3 Auth does not make SQLite multi-user; true business-data isolation depends on Phase 4 repositories.
3. Final production callback URLs, cookie security, and deployment environment variables must be validated on the eventual Vercel domain.
