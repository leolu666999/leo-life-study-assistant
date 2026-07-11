# Supabase Phase 3 Auth

## Implemented

- Email/password registration and login.
- Supabase SSR browser and server clients.
- Cookie-backed session persistence and refresh middleware.
- Logout, forgot-password request, recovery callback, and password update.
- Protected private pages and `401` responses for anonymous private APIs.
- `403` for authenticated non-admin users at Admin APIs.
- Server-only `ADMIN_USER_ID` identity boundary.
- Settings-page account identity and logout control in Auth mode.
- PWA cache bypass for Auth pages and callbacks.
- Dedicated Auth-test SQLite and uploads with fail-closed path validation.

## Local mode

Local mode remains the default and needs no Supabase variables:

```text
DATA_BACKEND=sqlite
AUTH_REQUIRED=false
```

It continues to use the existing SQLite, WAL/SHM, and uploads in the legacy Application Support directory. No login page is forced. Electron, PWA, and same-Wi-Fi phone access retain their current behavior.

## Auth test mode

Auth test mode must use a fresh directory created under the operating-system temporary directory. `.env.example` documents every required variable. Secrets remain in `.env.supabase-test.local`, which is ignored by Git and must stay server-only.

The Auth test database contains schema plus default local settings only. It never copies the repository database, Application Support database, or real uploads. This mode validates Auth behavior, not cloud business-data ownership.

## Password email limitation

The isolated Supabase project's built-in email sender currently applies a low email rate limit. The recovery-token verification and password update flow passed with a real Supabase recovery token. Reliable end-to-end email delivery requires custom SMTP configuration before production rollout.

## Not changed

- No real SQLite rows were migrated or assigned to an account.
- No SQLite table received `user_id`.
- No real upload was read or uploaded.
- `DATA_BACKEND` was not switched to Supabase.
- No Vercel deployment or production registration was enabled.
