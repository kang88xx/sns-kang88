# Verification

## Automated

`npm run check`, `npm test`, `npm run build`.

The 15 core tests cover KST midnight, leap days/year rollover, Monday-first 42-cell calendars, supported record dates, multilingual content, unsafe URL rejection, filtering without mutation, future publication stats, streaks, persisted empty data, corrupt storage, whole-file import validation, storage quota failures, and freshness-aware merge. Storage tests also exercise stale writes before a storage event arrives, snapshot refresh, external deletion, and explicit recovery.

The cross-tab guard compares a saved snapshot before writing. It is an optimistic check, not an atomic lock; these tests do not prove that simultaneous writes from separate tabs cannot race.

## Browser acceptance

- Create Threads plan with date/time and multilingual text; reload and search it.
- Edit existing record and verify focus returns to its visible opener.
- Delete and undo the test record.
- Concurrent tabs: dirty editor must not overwrite a record added in another tab; closing/reopening recovers both records.
- Desktop and 360/768px layouts: month grid, bottom nav, selected-day cards, no horizontal page overflow.
- Backups: download version 1 JSON; inspect the add/update/keep counts before confirming import. Existing records absent from the backup remain, only newer matching IDs replace current records, and the current weekly goal remains.
- Recovery: use a corrupt local storage fixture; download the original bytes, then explicitly restore a valid backup. Recovery replaces the stored records and weekly goal with the backup values. Invalid files or failed writes must not replace the stored bytes.
- Deployment: HTTPS 200, all modules load, visible initial two records and public URLs; no critical console error.

These browser items are acceptance checks, not a record of completed deployment verification. Browser test records belong to localhost and are not shipped in seed.js.
