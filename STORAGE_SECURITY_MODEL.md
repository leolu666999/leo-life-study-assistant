# Storage Security Model

## Ownership boundaries

- PostgreSQL metadata owner: `uploaded_files.user_id = auth.uid()` under forced RLS.
- Storage owner path: the first object-path segment must equal `auth.uid()`.
- Business references: owner-aware composite foreign keys prevent cross-user Expense and Important File links.
- Admin Account: ordinary file APIs and Storage access remain owner-only. Future cross-user access must use an authenticated `/api/admin/*` server route and a short-lived URL.

## Accepted files

Cloud mode accepts PDF, JPEG, PNG, and WebP up to 10 MiB. Validation checks the original filename for traversal, requires a matching extension and MIME, verifies magic bytes, sanitizes the stored object name, and computes SHA-256. Browser `file.type`, client bucket, path, owner, and linked entity ID are not trusted. Equal hashes remain separate between users.

## Reads

The established `GET /api/uploads/[id]` response remains an authenticated binary proxy. `?signed=1` returns a 60-second signed URL after owner metadata lookup. Signed URLs are not persisted. Anonymous, foreign-user, and ordinary Admin Account lookups cannot obtain another user's URL or bytes.

## Writes and deletes

The authenticated user client performs ordinary Storage operations, so Storage policies and metadata RLS both apply. Upload failures are retained as visible `failed` metadata. Deletes transition through `pending_delete`; object existence is checked before removal and absence is checked afterward. A failure leaves the metadata available for reconciliation and the API reports failure.

## Remaining controls

This phase does not include malware scanning, per-user quotas, background reconciliation, direct signed uploads, or cross-user Admin file UI. Those controls should be added before broad public file uploads or larger file limits.
