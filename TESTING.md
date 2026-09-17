# Verification

## Automated

`npm run check`, `npm test`, `npm run build`.

Core tests cover KST midnight, leap days/year rollover, Monday-first 42-cell calendars, supported record dates, multilingual content, unsafe URL rejection, filtering without mutation, future publication stats, streaks, persisted empty data, corrupt storage, atomic import, storage quota failures and freshness-aware merge.

## Browser acceptance

- Create Threads plan with date/time and multilingual text; reload and search it.
- Edit existing record and verify focus returns to its visible opener.
- Delete and undo the test record.
- Concurrent tabs: dirty editor must not overwrite a record added in another tab; closing/reopening recovers both records.
- Desktop and 360/768px layouts: month grid, bottom nav, selected-day cards, no horizontal page overflow.
- Backups: download JSON, validate/merge import without deleting current data.
- Deployment: HTTPS 200, all modules load, visible initial two records and public URLs; no critical console error.

Browser test records belong to localhost and are not shipped in seed.js.
