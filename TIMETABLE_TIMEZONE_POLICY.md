# Timetable Timezone Policy

Updated: 2026-07-12

## Canonical storage

- `startAt`, `endAt`, `originalStartAt`, `occurrenceStart`, and
  `sourceUpdatedAt` are absolute instants stored as PostgreSQL `timestamptz` and
  returned as ISO-8601 strings.
- `timetable_sources.timezone` is an IANA timezone name, normally
  `Australia/Sydney`.
- The UI continues to render timetable dates and times in
  `Australia/Sydney`, independent of the computer or phone timezone.

## ICS interpretation

1. Values ending in `Z` are UTC instants.
2. Values with a TZID use that IANA zone.
3. A VTIMEZONE definition is registered with `ical.js` when present.
4. If ical.js exposes a TZID value as floating because the file omitted
   VTIMEZONE, the parser converts its wall-clock fields with `Intl` using the
   TZID parameter.
5. Floating values without TZID use the import source timezone.
6. Date-only values use midnight in the source timezone because the current
   model has no all-day field.
7. Invalid source or event timezones reject preview instead of silently using
   the server timezone.

## Recurrence and exceptions

- RRULE/RDATE expansion occurs in the event's wall-clock timezone so a 09:00
  Sydney weekly class remains 09:00 across DST.
- The stored UTC offset may therefore change from `+10:00` to `+11:00`.
- EXDATE removes the matching recurrence slot.
- RECURRENCE-ID is the stable original slot and becomes `occurrenceStart` and
  `originalStartAt` for an exception.
- A moved exception's `startAt` is its replacement instant, not its identity.
- A cancelled exception keeps the original slot identity and status
  `cancelled`.

## Sydney DST examples

- Before the October transition, 09:00 Sydney is normally `23:00Z` on the
  previous UTC date.
- After the transition, 09:00 Sydney is normally `22:00Z` on the previous UTC
  date.
- UI rendering in Sydney remains 09:00 in both cases.

Tests use actual 2026 `Australia/Sydney` transition dates rather than fixed
offset assumptions.

## Range and scope calculations

- API `from` and `to` are absolute ISO instants.
- Week/month edit scopes are calculated using Sydney calendar boundaries, then
  converted to UTC for database filtering.
- Cross-midnight events retain absolute start/end instants and can span two
  Sydney date keys.

## Device timezone

Changing the computer or phone timezone does not change stored instants or the
course display clock. Non-timetable modules may use their own timezone policy;
Phase 5 does not alter them.

## Ambiguous and nonexistent local times

The existing iterative wall-time conversion selects one valid instant for an
ambiguous fall-back time. Nonexistent spring-forward wall times cannot be
represented exactly and are rejected when round-trip validation does not match
the requested wall time. This avoids silently shifting a class by an hour.
