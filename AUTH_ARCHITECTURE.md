# MyAssist Auth Architecture

## Phase 3 boundary

Phase 3 adds real Supabase Auth without pretending that the existing single-user SQLite database is multi-user. Phase 4 now supplies owner-scoped cloud repositories for the approved core modules while local data remains separate.

| Mode | Required settings | Business data | Auth | Status |
| --- | --- | --- | --- | --- |
| Local | `DATA_BACKEND=sqlite`, `AUTH_REQUIRED=false` | Existing SQLite and local uploads | Not required | Default |
| Auth test | `DATA_BACKEND=sqlite`, `AUTH_REQUIRED=true`, `TEST_DATABASE=true` | Dedicated empty SQLite and uploads under `AUTH_TEST_DATA_ROOT` | Required | Phase 3 testing only |
| Cloud | `DATA_BACKEND=supabase`, `AUTH_REQUIRED=true` | PostgreSQL with `user_id`; Storage deferred | Required | Core Phase 4 modules |

## Fail-closed data guard

Auth test mode requires explicit values for `AUTH_TEST_DATA_ROOT`, `LEO_APP_DATA_DIR`, `LEO_DATA_DIR`, `LEO_UPLOADS_DIR`, `LEO_DB_PATH`, and `LEO_LOG_DIR`. The Node guard resolves every path and requires all of them to remain under both the operating-system temporary directory and the dedicated Auth test root.

It rejects:

- the real `~/Library/Application Support/Leo的生活学习助手` directory;
- repository `data/` and `uploads/` directories;
- implicit/default data paths;
- a database outside its declared data directory;
- any test path outside the system temporary directory.

The middleware performs an additional early check and returns `503` before page or API access when the configuration is unsafe. The database module performs the authoritative resolved-path check before opening SQLite. Auth test mode also skips legacy SQLite/uploads copying.

## Session flow

The browser uses only the Supabase Project URL and publishable key. Login writes the Supabase session into SSR cookies. Middleware refreshes and validates the cookie-backed user on each protected request. The callback exchanges the PKCE code for a session, and sign-out removes the local session.

Public routes are `/login`, `/register`, `/forgot-password`, `/reset-password`, and `/auth/callback`. All application pages and private `/api/*` routes require a verified user only when `AUTH_REQUIRED=true`. With Auth disabled, middleware immediately passes through and local behavior is unchanged.

## Personal and Admin accounts

Personal Account and Admin Account are separate Supabase Auth users. The only trusted administrator source is the server-only `ADMIN_USER_ID` comparison. A client-supplied `user_id`, email, name, device, or `isAdmin` value is ignored.

The Admin Account remains an ordinary RLS user in normal application APIs. Cross-user access is possible only through `/api/admin/*`, after `assertAdmin()` succeeds, using a server-only high-privilege client. Neither `ADMIN_USER_ID` nor `SUPABASE_SECRET_KEY` is imported into client components.

## Phase 4 status

Phase 4 core repositories now pass the verified Session user into Repository Context and use authenticated RLS clients for Settings, Tasks, To Do, Plans, Journal, and Expenses. Timetable and Storage remain deferred. Existing local-record ownership still requires an explicit future reconciliation; global Cloud mode must not be applied to real local data before that migration is designed and verified.
