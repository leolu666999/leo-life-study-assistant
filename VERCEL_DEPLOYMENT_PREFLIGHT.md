# Vercel Deployment Preflight

## Decision

MyAssist can be deployed to Vercel as an isolated Cloud test application after the Phase 7A guards in this change are present. It must never be deployed with the default local configuration. Vercel requests are accepted only when `DATA_BACKEND=supabase`, `FILE_BACKEND=supabase`, and `AUTH_REQUIRED=true`, with all required Supabase and Admin variables present. Any incomplete Vercel configuration returns 503 from middleware before private application access.

The deployment remains a test/preview environment. It does not migrate the real 282 SQLite rows or four local uploads and is not a production launch.

## Three environments

| Environment | Data | Files | Auth | Intended use |
|---|---|---|---|---|
| Local | SQLite | local uploads | off | Existing Mac, Electron, PWA, LAN on port 3011 |
| Vercel test | Supabase PostgreSQL | private Supabase Storage | required | Maintainer-only cross-device testing |
| Future production | Supabase PostgreSQL | private Supabase Storage | required | Not enabled in Phase 7A |

## Framework and Route Handlers

The repository is a Next.js 15 App Router application. Page routes, Auth callback, authenticated CRUD handlers, Supabase repositories, ICS parser, timetable transaction RPCs, and protected file handlers are compatible with the Vercel Node runtime. Calendar Feed uses bounded HTTP fetch with protocol, DNS/private-address, redirect, timeout, size, and content-type checks and is compatible with a finite Vercel Function invocation.

Cloud-specific treatment for local utilities:

| Route | Vercel behavior |
|---|---|
| `/api/health` | Reports only Supabase mode; no local paths or SQLite call |
| `/api/backup/export` | Returns 409 before dynamically loading the SQLite exporter |
| `/api/network` | Returns the public request origin instead of LAN interfaces/port 3011 |
| `/api/events` | Returns 204; process-local SSE is disabled in serverless Cloud mode |
| `/api/sync/push` | Returns 409; Cloud offline replay remains disabled until idempotent sync exists |

All ordinary business APIs use `repositoryContextForRequest`, the verified Supabase Session, and owner-scoped repositories. File routes additionally require `FILE_BACKEND=supabase`. `getDb()` itself refuses any non-SQLite backend. No Cloud request has permission to create a temporary SQLite fallback or use local uploads.

## Local dependencies

`lib/db.ts`, the SQLite repositories, `lib/app-config.ts`, Electron, migration preflight, icon generation, and standalone preparation still use `node:sqlite`, `node:fs`, macOS Application Support paths, or local uploads. They remain required for Local mode. Cloud utility routes now avoid executing those paths. Electron entry points and scripts are not browser routes and do not affect the Vercel Next.js deployment.

Static repository selection still bundles both implementations in the server build, but Cloud selection is fail-closed and no SQLite database is opened unless `DATA_BACKEND=sqlite`. Both Cloud and Local production builds pass. This should be revisited if Vercel function tracing reports excessive bundle size.

## Environment variables

### Browser-safe

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Isolated Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public/anon publishable key; RLS remains the data boundary |

### Server-only

| Variable | Purpose |
|---|---|
| `SUPABASE_SECRET_KEY` | Controlled Admin API only; never used by ordinary browser clients |
| `ADMIN_USER_ID` | Exact UUID of the separate Admin Account |

### Runtime mode

| Variable | Required value |
|---|---|
| `DATA_BACKEND` | `supabase` |
| `FILE_BACKEND` | `supabase` |
| `AUTH_REQUIRED` | `true` |

Vercel supplies `VERCEL`/`VERCEL_ENV`; these activate the strict deployment guard. Do not configure `LEO_*`, `TEST_DATABASE`, `AUTH_TEST_DATA_ROOT`, test-user passwords, database password, Supabase access token, or local paths in Vercel. No `.env` file is committed.

## Auth and redirects

Registration and password reset derive `redirectTo` from `window.location.origin`, so localhost and the Vercel domain each produce their own `/auth/callback` URL. The callback passes `next` through `safeRedirectPath`, which accepts only same-site relative paths and rejects absolute/protocol-relative targets and Auth loops. Supabase must retain localhost entries and add the exact Vercel test origin plus its callback wildcard/route.

## PWA

The manifest and icons are static and compatible with HTTPS. The service worker does not intercept `/api/*`, `/auth/*`, login/register/forgot/reset, or `/_next/*`; navigation is network-first and only falls back to the public offline page. Private API responses and Auth callbacks are not placed in Cache Storage. `offline.html` is excluded from Auth middleware so installation works before login.

## Upload limit blocker and mitigation

The existing compatibility endpoint buffers multipart uploads in a Vercel Function. Vercel documents a 4.5 MB Function request/response payload limit, so the application now caps Vercel multipart uploads at 4 MiB while the Storage bucket itself remains capped at 10 MiB. Synthetic E2E files must stay below 4 MiB. Direct signed browser-to-Supabase uploads are the correct later path for the full 10 MiB product limit. See [Vercel Function limits](https://vercel.com/docs/functions/limitations) and [Vercel's direct-upload guidance](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions).

## Secret and data checks

- `.env*`, `data/*`, `uploads/*`, migration reports, build output, and Supabase local state are ignored.
- Only `.env.example`, `data/.gitkeep`, and `uploads/.gitkeep` are tracked.
- Client static bundle scans must show zero `SUPABASE_SECRET_KEY`, `ADMIN_USER_ID`, test password, or secret value matches.
- Vercel deployment source must be the GitHub `main` commit after Phase 7A preflight changes are pushed.
- No migration or upload command in Phase 7A reads the real local file contents for deployment.

## Remaining risks

1. Multipart upload and binary proxying are suitable only for sub-4 MiB test files on Vercel.
2. Cloud mode has no idempotent offline replay; `/api/sync/push` intentionally returns 409.
3. Process-local SSE is unavailable; cross-device updates appear after normal refresh/refetch rather than instant server push.
4. Automated Storage reconciliation and malware scanning remain future work.
5. Preview deployments need deliberate Supabase redirect allowlisting; wildcard preview domains should not be broadly allowed for production.

No blocker remains for a maintainer-only test deployment once Vercel authentication and environment configuration are complete.
