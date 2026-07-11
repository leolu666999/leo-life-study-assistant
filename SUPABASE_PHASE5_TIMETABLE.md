# Supabase Phase 5 Timetable

Updated: 2026-07-12

## Delivered

Phase 5 adds one `SupabaseTimetableRepository` and a server-only Calendar Feed
helper. Cloud mode now supports the existing timetable API surface:

- `GET /api/courses`
- `GET /api/timetable`
- `POST /api/timetable/import/preview`
- `POST /api/timetable/import/confirm`
- `PATCH /api/timetable/occurrences/[id]`
- `DELETE /api/timetable/occurrences/[id]`

Routes, HTTP methods, successful status codes, and primary JSON shapes remain
compatible. All routes acquire trusted request context. Cloud failures do not
fall back to SQLite or local uploads.

## Repository behavior

- Legacy courses/sessions/assignments remain owner-only compatibility reads.
- Sources, timetable courses, and occurrences are filtered by the current
  Session owner.
- Occurrence date filters preserve the existing inclusive `from`/`to`
  semantics.
- PATCH supports only the real `single`, `series`, `future`, `week`, and
  `month` scopes. Unknown scopes fall back to `single`.
- DELETE remains a soft cancellation.
- `localModifiedFields` remains a string array and protects locally edited rows
  from re-import.
- Admin Account ordinary timetable calls remain owner-only.

## Transactional confirm

Migration `202607120003_phase5_timetable_cloud_import.sql` adds:

- nullable private `timetable_sources.sourceKey`;
- owner-scoped source and course identity indexes;
- one `security invoker` function: `import_timetable_preview_atomic(jsonb)`.

The function derives owner only from `auth.uid()`. Source, course, occurrence,
and final sync-status writes execute in one PostgreSQL transaction. Unknown
course references, invalid status, constraints, or any other mid-import error
roll back all three business tables.

## Duplicate and reconciliation policy

- Feed source key: SHA-256 of normalized Feed URL.
- ICS source key: SHA-256 of exact ICS text.
- Occurrence identity: `(user_id, sourceId, externalUid, occurrenceStart)`.
- `occurrenceStart` is the original recurrence slot, including moved or
  cancelled exceptions.
- Repeated confirm reuses the source and updates existing instances.
- Different users can import the same UID without conflict.
- Locally modified occurrences are skipped and counted as conflicts.
- Events removed from a Feed are not inferred as cancelled; explicit cancelled
  events/exceptions are required.

## ICS support

The parser retains `ical.js` and supports the behavior it actually exposes:

- VEVENT, UID, DTSTART, DTEND, SUMMARY, DESCRIPTION, LOCATION and STATUS;
- RRULE, RDATE and EXDATE recurrence expansion;
- RECURRENCE-ID exceptions related only to the matching UID master;
- moved and cancelled recurrence instances;
- TZID and VTIMEZONE;
- LAST-MODIFIED, with DTSTAMP fallback for `sourceUpdatedAt`.

Expansion remains bounded to seven months after the earliest event and 500
instances per event. Date-only events map to source-timezone midnight because
the current model has no all-day field.

## Calendar Feed safety

The server helper permits only HTTP/HTTPS and validates DNS/address ranges for
the initial URL and every redirect. It blocks localhost, private/link-local,
reserved, multicast, and metadata destinations; rejects embedded credentials;
limits redirects to 3, timeout to 8 seconds, and response size to 5 MB; and
performs a basic calendar/text content-type check.

Full DNS-rebinding protection still requires address-pinned outbound networking
or an egress proxy in production. Error messages and logs do not include the
full Feed URL.

## Local mode protection

`DATA_BACKEND=sqlite` still selects the unchanged synchronous SQLite Timetable
Repository. No SQLite schema, timetable row, local upload, Electron behavior,
PWA behavior, or frontend layout is changed. No real timetable or file data was
migrated.

## Next boundary

Course/Timetable Cloud Repository is ready for the next isolated phase. Storage
and Files should be implemented next with private buckets, metadata
transactions, owner paths, and short-lived signed URLs before any real file
migration.
