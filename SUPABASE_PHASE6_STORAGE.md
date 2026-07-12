# Supabase Phase 6 Storage

Phase 6 adds Cloud file support without migrating any real local file. Local mode remains `DATA_BACKEND=sqlite`, `FILE_BACKEND=local`; Cloud mode requires `DATA_BACKEND=supabase`, `FILE_BACKEND=supabase`, and `AUTH_REQUIRED=true`. Any incomplete or mixed Cloud configuration fails closed instead of reading local uploads.

Cloud mode now supports the existing multipart upload and binary download contracts, Important Files CRUD, Expense receipt ownership checks, private Storage objects, and short-lived signed downloads. The authenticated Session is the only owner source. The server selects one of the two approved buckets and creates `{user_id}/{file_id}/{sanitized_name}`; request bodies cannot select an owner, arbitrary bucket, or object path.

The two private buckets are `receipts` and `important-files`. Both are configured for PDF, JPEG, PNG, and WebP with a 10 MiB object limit. The compatibility route verifies filename safety, extension, MIME, file signature, size, and SHA-256 before writing metadata. It buffers the file in the Node route, so direct signed upload is the recommended later optimization for files larger than this first release permits.

`uploaded_files` tracks `pending`, `uploaded`, `failed`, `pending_delete`, and `deleted`. Upload metadata is created as pending before Storage upload and finalized only after object success. Important File and Expense deletion detach references through owner-scoped PostgreSQL functions, retain shared objects, and move unreferenced objects to `pending_delete`. The server verifies the object before and after removal before marking metadata deleted.

Two migrations, `202607120004_phase6_storage_lifecycle.sql` and `202607120005_phase6_pending_delete_retry.sql`, are applied to the isolated Supabase test project only. They configure the two buckets, add the owner/status index, strengthen Expense receipt validation, and add owner-scoped Important File, delete-lifecycle, and pending-delete retry functions. No production backend was switched, and no real SQLite data or local file was uploaded.

Validation totals are 292/292: 134 local/schema/API tests, 42 Repository tests, 13 transaction tests, 27 timetable tests, 20 Auth tests, 36 RLS/Admin/Storage tests, and 20 new Phase 6 Storage tests. Cross-user file access, partial invisible state, and unauthorized success were all zero.
