# Phase 6 Cloud Storage Test Results

## Result

All 20 new real remote Storage tests passed against the isolated Sydney Supabase test project. The full matrix is 292/292 passing.

| Suite | Tests | Result |
|---|---:|---|
| Local API/schema/Auth/timezone/timetable/file validation | 134 | Passed |
| Cloud Repository | 42 | Passed |
| PostgreSQL transaction failure injection | 13 | Passed |
| Timetable Cloud | 27 | Passed |
| Auth | 20 | Passed |
| RLS/Admin/private Storage | 36 | Passed |
| Phase 6 Storage/File | 20 | Passed |

The Phase 6 suite covered authenticated PDF/PNG uploads, anonymous rejection, 10 MiB rejection, unsupported MIME, signature mismatch, traversal names, exact binary download, signed URL generation, A/B/Admin ordinary isolation, same-hash separation, Important Files CRUD, cross-user UUID guessing, Expense receipt linkage, cross-user receipt rejection, shared receipt retention, final-reference cleanup, forced delete failure, and private bucket configuration.

Denied writes were checked against PostgreSQL and Storage state. Cross-user file disclosure was zero. Unauthorized mutation was zero. Partial invisible state was zero. The forced failure remained visible as `pending_delete` until test cleanup.

Two migrations were applied remotely. The remote migration ledger now matches local through `202607120005`. Synthetic test records and objects were cleaned after each suite. No real local file was uploaded.

The real local baseline remained byte-for-byte unchanged: SQLite, WAL, SHM, and all four local uploads retained their initial SHA-256 hashes; counts stayed at 21 tables, 282 rows, four uploaded-file rows, four Important Files, and zero Expense receipt links.
