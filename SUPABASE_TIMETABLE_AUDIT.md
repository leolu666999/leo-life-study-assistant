# Supabase Timetable Audit

Updated: 2026-07-12

## Scope

This audit covers the current timetable APIs, the SQLite implementation, ICS
parser, recurrence handling, occurrence editing/cancellation, feed fetching, and
the Phase 5 Supabase boundary. It does not migrate or modify real timetable
data.

## Current APIs and dependencies

| API | Current behavior | Tables |
| --- | --- | --- |
| `GET /api/courses` | Lists legacy courses with sessions and assignments | courses, class_sessions, assignments |
| `GET /api/timetable` | Lists sources, current timetable courses, and filtered occurrences | timetable_sources, timetable_courses, course_occurrences |
| `POST /api/timetable/import/preview` | Parses uploaded/text ICS or fetches a feed; does not write | none |
| `POST /api/timetable/import/confirm` | Creates/updates source, courses, occurrences and sync status | timetable_sources, timetable_courses, course_occurrences |
| `PATCH /api/timetable/occurrences/[id]` | Updates allowed occurrence fields using a scope | course_occurrences |
| `DELETE /api/timetable/occurrences/[id]` | Soft-cancels using the same scope logic | course_occurrences |

## Layer ownership

- Route handlers own HTTP parsing, status codes, trusted request context, and
  realtime mutation responses.
- `TimetableService` owns preview orchestration and feed retrieval.
- `lib/ics-timetable.ts` owns VEVENT parsing, course extraction, recurrence
  expansion, occurrence identity candidates, and preview summaries.
- The Repository owns persistence, owner filtering, row mapping, duplicate
  reconciliation, scoped edits, and cancellation.
- The SQLite Repository delegates to the established synchronous `lib/db.ts`
  implementation. Phase 5 must not change those functions.

## Current write risks

`importTimetablePreview` writes three tables through many independent SQLite
statements. Source creation can succeed before a course or occurrence fails.
The Supabase implementation therefore requires one PostgreSQL transaction.

Occurrence PATCH/DELETE only updates one table with one SQL statement and does
not require an RPC transaction. Legacy course reads are read-only.

## Current duplicate identity

The PostgreSQL occurrence uniqueness boundary is:

`(user_id, sourceId, externalUid, occurrenceStart)`

This is the correct instance-level identity and must remain. Title and course
code are not safe identities. `occurrenceStart` represents the original
recurrence slot; a moved exception keeps the original slot while `startAt`
contains its new time.

The existing parser used `startAt` as `occurrenceStart` for exceptions and did
not relate RECURRENCE-ID events to the RRULE master. That could leave both the
generated master instance and its replacement. Phase 5 must relate exceptions
before expansion and use RECURRENCE-ID as stable instance identity.

The existing SQLite confirm only looks for an existing occurrence when the
preview row already has `sourceId`; parser previews use `sourceId = null`.
Therefore duplicate reconciliation is incomplete in local code. Local mode is
left unchanged, while Cloud mode performs reconciliation with the persisted
source ID inside the transaction.

## Source identity

- Calendar feed identity is the SHA-256 of its normalized URL.
- Uploaded/text ICS identity is the SHA-256 of the exact ICS payload.
- Only the digest is used for stable source matching; the feed URL remains a
  private owner row.
- A nullable `sourceKey` column and owner-scoped unique index are required.

This lets repeat confirm/sync reuse the same source and occurrence identity
without exposing feed tokens in logs or relying on mutable display names.

## Recurrence support found in real code

- RRULE, RDATE, and EXDATE are delegated to `ical.js` recurrence expansion.
- Expansion is bounded to seven months after the earliest event and 500
  instances per event.
- VEVENT STATUS=CANCELLED maps to a soft-cancelled occurrence.
- RECURRENCE-ID is detected but was not related to its master event.
- `sourceUpdatedAt` is parsed from LAST-MODIFIED, then DTSTAMP, but the SQLite
  confirm currently replaces it with import time.
- Removed feed instances are not automatically inferred as cancelled; an
  explicit cancelled exception is required.

Phase 5 will correct master/exception expansion and preserve parsed
`sourceUpdatedAt`. It will not invent deletion reconciliation that the current
product does not have.

## Edit and cancellation semantics

The only real scopes are:

- `single`: selected occurrence only.
- `series`: all occurrences with the same `courseId`.
- `future`: same course from selected `startAt` onward.
- `week`: same course within the Sydney calendar week.
- `month`: same course within the Sydney calendar month.

Unknown scope values fall back to `single`. PATCH accepts only `startAt`,
`endAt`, `location`, `campus`, `notes`, and `status`. It sets `isException`,
`localModifiedAt`, and replaces `localModifiedFields` with the fields changed in
that request. DELETE is a soft cancellation (`status = cancelled`), never a
physical delete.

For non-single scopes, already locally modified rows remain protected, matching
the SQLite condition. `single` can edit an already modified row.

## localModifiedFields and re-import

The field is a JSON array. Empty means a remote import may update the row. A
non-empty array causes Cloud re-import to count a conflict and skip the remote
update, preserving all local values. Invalid non-string entries are rejected at
the Repository/RPC boundary. There is no per-field merge today.

## Feed URL security audit

The current Service calls `fetch(feedUrl)` directly with no protocol, private
network, redirect, timeout, response size, or content-type checks. This is an
SSRF risk. Phase 5 will add a small server-only fetch helper that:

- permits only HTTP/HTTPS;
- blocks localhost, loopback, private/link-local/multicast IP ranges, and cloud
  metadata targets;
- resolves hostnames before each request;
- validates every redirect and limits redirect count;
- uses a timeout and response size limit;
- accepts calendar/text content types and rejects obvious HTML/JSON responses;
- never includes the full feed URL in errors or logs.

DNS rebinding between validation and the network connection remains a known
risk without a pinned-address HTTP agent. Production deployment should add an
egress proxy or address-pinned fetch before accepting untrusted public feeds.

## Cloud repository requirements

- All reads and writes use the current authenticated client and `auth.uid()`.
- No owner ID is accepted from client input.
- RLS and owner-aware composite foreign keys remain active.
- Admin ordinary APIs remain owner-only.
- Import confirm uses one `security invoker` PostgreSQL function.
- Cloud failure never falls back to SQLite or local uploads.
- Feed URLs retain the existing response shape for compatibility, despite being
  sensitive. A future API version should return a redacted indicator instead.

## Legacy courses

The legacy `courses`, `class_sessions`, and `assignments` schema and RLS remain.
Cloud `GET /api/courses` can read the current user's legacy rows for API
compatibility. No legacy/current merge, migration, or manual course creation is
introduced.

## Known limits

- Expansion remains bounded to the parser's current semester-sized window.
- All-day/date-only VEVENT has no dedicated all-day field and is represented at
  midnight in the selected source timezone.
- Feed removal without CANCELLED/RECURRENCE-ID is not treated as cancellation.
- There is no ETag, If-Modified-Since, background cron, or complete cloud
  offline sync in Phase 5.
