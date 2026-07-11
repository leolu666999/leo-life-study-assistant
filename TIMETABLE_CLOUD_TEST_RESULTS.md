# Timetable Cloud Test Results

Updated: 2026-07-12

## Phase 5 tests

- Local parser/timezone/feed tests: **16/16 passed**
- Real remote timetable tests: **27/27 passed**
- New Phase 5 tests: **43/43 passed**

## Full regression

| Suite | Result |
| --- | --- |
| Local API/RLS/Auth/timezone/timetable tests | 128/128 |
| Remote core Repository tests | 42/42 |
| Remote transaction tests | 13/13 |
| Remote Auth tests | 20/20 |
| Remote RLS/Admin/Storage tests | 36/36 |
| Remote timetable tests | 27/27 |
| Total | **266/266** |

The original Phase 4.5 matrix remains 223/223. Phase 5 adds 43 tests.

## Verified timetable behavior

- Query owner isolation for User A, User B, and Admin ordinary API.
- Preview performs no writes.
- Single event and weekly recurrence.
- EXDATE removal.
- RDATE additions, including DTSTART preservation.
- Moved RECURRENCE-ID exception with stable original identity.
- Cancelled exception without duplicate instance.
- Repeated confirm without source/course/occurrence growth.
- Same external UID across different users.
- `includeCancelled`, absolute from/to filters, and API mapping.
- Single edit and multi-field `localModifiedFields`.
- Unknown edit fields cannot clear local modification protection.
- Re-import conflict protection for local modifications.
- Single and series-related soft cancellation.
- Legacy Cloud `GET /api/courses` owner isolation.
- Cross-user source/course/occurrence composite-FK rejection.
- Anonymous API/RPC rejection.
- Mid-import unknown course and invalid status rollback.
- Calendar Feed protocol/private-network/redirect/size/content-type protection.

## Time verification

- Australia/Sydney standard time.
- Sydney DST transition with stable 09:00 wall time.
- UTC conversion before and after transition.
- Cross-midnight events.
- TZID without VTIMEZONE fallback.
- Invalid IANA timezone rejection.
- Device/server timezone independence through explicit Sydney rendering.

## Security and atomicity result

- Unauthorized cross-user successes: **0**
- Partial import states: **0**
- Rejected writes that changed the database: **0**
- Real rows migrated: **0**
- Real files uploaded: **0**

The Auth suite accepts Supabase's documented rate limit and the isolated
synthetic email provider's `email_address_invalid` response for the forgot
password send step. Login, verified password recovery, SSR Session, account
separation, and the other Auth assertions still pass.

## Remaining risks

- DNS rebinding between address validation and connection needs production
  egress pinning.
- Feed deletions without explicit CANCELLED data are not reconciled.
- Recurrence expansion is bounded, not an unlimited background sync engine.
- Real timetable ownership has not been assigned or migrated.
