# File Delete Compensation Policy

Storage and PostgreSQL do not share a transaction. MyAssist therefore uses an explicit, observable compensation flow:

1. A security-invoker PostgreSQL function locks and removes the current user's business reference.
2. It counts the same user's remaining `important_files` and `expenses` references.
3. Shared files remain `uploaded` and are not removed.
4. An unreferenced file becomes `pending_delete`, and the function returns its approved bucket and owner path.
5. The server confirms that object exists at that exact path, removes it, and confirms that it no longer exists.
6. Only then does metadata become `deleted` with `deletedAt`.

If PostgreSQL detachment fails, Storage is untouched. If Storage removal or verification fails, metadata remains `pending_delete`; the API fails visibly. The owner-scoped `prepare_pending_file_delete` function and Repository retry helper re-check references and can complete the same verified removal later. This avoids both invisible orphan objects and database rows that claim an unavailable file is still uploaded.

Deleting an Expense follows the same policy as deleting an Important File. A receipt shared by multiple Expenses is retained until the final reference is removed. Replacing an Expense receipt evaluates the old receipt after the new Expense transaction commits and cleans it only when it has no references.

Local mode intentionally retains its established SQLite behavior in Phase 6. No local cleanup migration or reinterpretation of the four real files was performed.
