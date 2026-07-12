# Public URL E2E Test Results

Status: automated backend/build checks passed; anonymous browser access to MyAssist login verified; physical phone/PWA checks pending.

Public test URL: `https://myassist-test.vercel.app`

## Phase 7 verified

- Local contract/security tests: 148/148 passed.
- Real Supabase Phase 7 tests: 7/7 passed.
- Real Auth lifecycle tests: 20/20 passed.
- Username login through `/api/auth/login`: HTTP 200 with an SSR session cookie.
- Duplicate username and duplicate email: rejected without an extra Auth user.
- Anonymous contact submission: accepted without exposing stored messages.
- Anonymous/ordinary direct message reads: denied.
- Ordinary Admin API access: 403; configured Admin Account: 200.
- Admin original-file access: 60-second signed URL only.
- Typecheck and clean production build: passed.
- Vercel Preview build: Ready.
- Vercel SSO Deployment Protection: disabled.
- Anonymous browser visit: HTTP 200 and redirected to `/login?next=%2F` with MyAssist login/register UI.
- Tracked source/client bundle secret value hits: 0.
- Desktop finance modal: no vertical or horizontal overflow at 1440x900.
- Mobile finance modal: single-column vertical scroll and zero horizontal overflow at 390x844.

## Manual checks still required

- Open the Preview from a phone/another network and confirm it reaches MyAssist login/register without Vercel login.
- Complete email confirmation and password-reset email links using the Preview callback allow-list.
- Install and relaunch the PWA on iOS/Android.
- Confirm camera/file picker behavior on a physical phone.

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

No physical cross-device item is marked passed until the maintainer runs it on the real device.
