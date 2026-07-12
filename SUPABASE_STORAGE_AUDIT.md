# Supabase Storage / File Audit

## Scope and baseline

This audit covers `FileRepository`, the SQLite implementation, `uploaded_files`, `important_files`, `expenses.receiptFileId`, and the upload/download/Important Files/Expense delete API paths. The protected local baseline is 21 SQLite tables, 282 rows, and four files in local uploads. Phase 6 must not migrate or mutate any of them.

## Current local flow

`POST /api/upload` parses multipart form data, converts the entire browser `File` to a Node `Buffer`, and calls `sqliteFileRepository.saveUpload`. The repository writes a UUID-based filename under the configured local uploads directory, then inserts a row in SQLite `uploaded_files`. `GET /api/uploads/[id]` loads the whole file into memory and returns it as a private binary response.

Local metadata lives in SQLite `uploaded_files`. `important_files.fileId` and `expenses.receiptFileId` reference it. Important Files list/create/update/delete is implemented through synchronous SQLite helpers. Creating an Important File or saving an Expense also writes the advisory `linkedEntityType` and `linkedEntityId` fields.

## Delete behavior and orphan risks

- Deleting an Important File first removes the business row, counts remaining Important File and Expense references, then deletes metadata and attempts to unlink the local object when no references remain.
- A failed local unlink is swallowed after metadata has already been deleted. That can leave an invisible local object.
- Deleting an Expense only removes the Expense row. An unreferenced receipt metadata row and local object can remain indefinitely.
- Upload writes the local object before metadata. If metadata creation fails, the object is orphaned.
- Cloud Storage and PostgreSQL cannot share one transaction, so cloud upload/delete needs explicit states and compensation.

## Validation and access findings

- The current API has no server-side file size limit, MIME allowlist, magic-byte verification, extension validation, or filename sanitization beyond extracting the extension for the stored name.
- Browser `file.type` is trusted and the entire file is read into memory.
- The random stored filename prevents direct use of the supplied path, so the local write path is not directly traversal-controlled by the browser. The original filename is nevertheless unsanitized metadata, and a cloud object path must never use it without sanitization.
- Local files are private only through the application API. There is no public uploads route; knowledge of an ID is sufficient in unauthenticated local mode by design.
- Existing private Supabase buckets are `receipts` and `important-files`. Their policies restrict authenticated operations to an object name whose first path segment equals `auth.uid()`.
- PostgreSQL metadata RLS restricts `uploaded_files` and `important_files` to their owner. Owner-aware composite foreign keys prevent a user's Expense or Important File from referencing another user's upload.

## Cloud design decisions

Phase 6 keeps the existing multipart API as a compatibility layer. Cloud uploads are limited to 10 MiB and to PDF, JPEG, PNG, and WebP, with MIME, extension, filename, and magic-byte checks. The object path is `{auth.uid()}/{file_id}/{sanitized_name}` and the bucket is selected server-side from the approved upload purpose (`expense` -> `receipts`; otherwise `important-files`). Client-supplied owner, bucket, path, and linked entity IDs are never trusted.

The state machine is `pending -> uploaded`, `pending -> failed`, and `uploaded -> pending_delete -> deleted`. Metadata is inserted before the Storage object. Failed upload is recorded as `failed`. Failed finalization triggers verified object removal; any failed cleanup remains visible in metadata for reconciliation. Deletion first detaches the business reference in a security-invoker RPC and marks an unreferenced file `pending_delete`; Storage removal then occurs and metadata is marked `deleted`. A failed Storage removal remains `pending_delete`, the API reports failure, and an owner-scoped retry function can safely resume it.

Cloud downloads preserve the existing binary response. The authenticated repository also exposes a short-lived signed URL capability for controlled use and tests; signed URLs are never persisted. Server-side multipart and binary proxying are acceptable for the current small-file compatibility release, but direct signed uploads/download redirects should be considered before supporting large files on Vercel.

## Transaction decisions

PostgreSQL functions atomically detach Important File or Expense references, count all current-user references, and transition metadata to `pending_delete` only when unreferenced. Storage deletion is compensated rather than presented as a cross-system transaction. Finance creation plus `lastUsedCurrency` remains in the existing PostgreSQL transaction RPC. Upload object/metadata consistency is handled by the explicit state machine.

## Known limitations

- Local mode intentionally retains its established validation and deletion behavior in this phase.
- The compatibility upload endpoint buffers up to 10 MiB in cloud mode.
- Automatic background retry of `failed` and `pending_delete` rows is not included; state remains queryable for a later reconciliation job.
- Only receipts and Important Files are in scope. Task, journal, avatar, and course-import buckets are not created.
