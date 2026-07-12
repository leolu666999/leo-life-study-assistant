# Cross-Device Test Checklist

Use test accounts and synthetic content only. Do not use the maintainer's real local records or files.

## Before testing

- Confirm the browser address is the Vercel HTTPS test URL.
- Confirm the deployment page identifies the expected Git commit.
- Keep Personal test account and User B credentials separate.
- Prepare one tiny synthetic PDF or PNG below 4 MiB.

## Device A: current Mac

- Sign in with the Personal test account.
- Create a Task titled `CROSS-DEVICE-A`.
- Create a dated To Do item with `13:00-13:30 CROSS-DEVICE-TODO`.
- Create a synthetic AUD expense and verify remembered currency.
- Upload the synthetic file and create an Important File.

## Device B: another computer

- Sign in with the same Personal test account.
- Confirm Task, To Do, expense, and Important File appear after refresh.
- Rename the Task to `CROSS-DEVICE-B-UPDATED`.
- Complete the To Do item.
- Open the signed/proxied synthetic file.

## Device C: iPhone Safari / installed PWA

- Open the same HTTPS URL and sign in with the same test account.
- Confirm the updated Task and completed To Do state.
- Add the app to the Home Screen and launch standalone.
- Confirm manifest icon and layout.
- Confirm logout returns to login and does not reveal cached private data.

## Isolation

- Sign out everywhere.
- Sign in as User B on one device.
- Confirm User A Task, To Do, expense, timetable, journal, settings, Important File, and file URL are absent/inaccessible.
- Guessing a copied User A UUID or file URL must not return data.

## Return propagation

- On Device A, refresh after Device B's edit.
- Confirm the updated Task and completion state appear.
- No instant push is expected in Phase 7A because process-local SSE is disabled on Vercel.

## Cleanup

- Delete synthetic Tasks, To Do lists/items, plans/journals, expenses, timetable imports, Important Files, receipts, and uploads created by this checklist.
- Keep test Auth profiles and default settings.
- Verify no `pending_delete`, orphan metadata, or Storage objects remain for the test run.
