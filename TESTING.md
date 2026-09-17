# Verification

## Automated

`npm run check`, `npm test`, `npm run build`.

The 20 automated tests cover KST midnight, leap days/year rollover, Monday-first 42-cell legacy calendars, compact 28/35/42-cell month calendars, supported record dates, multilingual content, unsafe URL rejection, filtering without mutation, future publication stats, streaks, persisted empty data, corrupt storage, whole-file import validation, storage quota failures, freshness-aware merge, YouTube round trips, and legacy idea/status compatibility. Storage tests also exercise stale writes before a storage event arrives, snapshot refresh, external deletion, and explicit recovery.

The cross-tab guard compares a saved snapshot before writing. It is an optimistic check, not an atomic lock; these tests do not prove that simultaneous writes from separate tabs cannot race.

## Browser acceptance

- Create undated YouTube content in the library; reload and search it.
- Schedule the same record, verify it appears on the calendar, then record publication and verify it moves to Published history.
- Verify September 2026 renders 35 cells and duplicate same-channel records show one icon per record without visible titles in calendar cells.
- Edit existing record and verify focus returns to its visible opener.
- Delete and undo the test record.
- Concurrent tabs: dirty editor must not overwrite a record added in another tab; closing/reopening recovers both records.
- Desktop and 360/768px layouts: month grid, bottom nav, selected-day cards, compact multi-icon days, no horizontal page overflow.
- Search/filter reset: global search covers library and published content; `#posts` and `#ideas` route to the library.
- Copy: body copy works from cards and editor, with the selection fallback available when clipboard permission is denied.
- Backups: download version 1 JSON; inspect the add/update/keep counts before confirming import. Existing records absent from the backup remain, only newer matching IDs replace current records, and the current weekly goal remains.
- Recovery: use a corrupt local storage fixture; download the original bytes, then explicitly restore a valid backup. Recovery replaces the stored records and weekly goal with the backup values. Invalid files or failed writes must not replace the stored bytes.
- Deployment: HTTPS 200, all modules load, visible initial two records and public URLs; no critical console error.

## v0.2 local verification — 2026-09-17

All 20 Node tests, syntax checks, build and diff whitespace checks passed. The seven build outputs were compared byte-for-byte with source. An independent code review approved the final app/build changes.

Eleven Chromium browser scenarios passed across a full run and targeted reruns: calendar layout/icons, library→schedule→published persistence, legacy routes/calendar keyboard navigation, edit/delete/undo, global search/filters, dialog cancellation/duplication, mobile editing, backup validation/merge/recovery, stale-editor protection, failed-save preservation, and denied-clipboard text selection. Screenshots were inspected at 1440/768/360px, including eight records on one mobile date. The reruns resolved local navigation timing failures; no application JavaScript errors were observed. Google Fonts were blocked in the interaction suite to exercise the system-font fallback.

Detailed local evidence is retained in ignored `artifacts/qa-v2/` (`browser.mjs`, `browser-results.json`, `browser-results-targeted.json` and screenshots). Browser test records belong to isolated localhost contexts and are not shipped in `seed.js`. Production verification remains pending; see `DEPLOYMENT.md` for the last verified release.
