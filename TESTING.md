# Verification

## Automated

`npm run check`, `npm test`, `npm run build`.

The original 20 model tests cover KST midnight, leap days/year rollover, Monday-first 42-cell legacy calendars, compact 28/35/42-cell month calendars, supported record dates, multilingual content, unsafe URL rejection, filtering without mutation, future publication stats, streaks, persisted empty data, corrupt storage, whole-file import validation, storage quota failures, freshness-aware merge, YouTube round trips, and legacy idea/status compatibility. Storage tests also exercise stale writes before a storage event arrives, snapshot refresh, external deletion, and explicit recovery.

The cross-tab guard compares a saved snapshot before writing. It is an optimistic check, not an atomic lock; these tests do not prove that simultaneous writes from separate tabs cannot race.

## Supabase photo verification — 0.3 prepared, not released

The suite now includes 32 Node tests. The 12 photo transport tests cover MIME/signature/size limits, encoded record IDs, public-only configuration, allowlist login, unavailable session storage, owner paths, authenticated private reads, pagination, deterministic retry at the ten-file limit, token refresh, denied-session recovery, local logout and incomplete deletion detection. These use mocked REST and do not prove hosted RLS.

`tests/photo-browser.mjs` adds 11 isolated Chromium scenarios: staged cancel, upload/reload/remove/publish, zero remote writes on failed local save, upload retry preserving the same record, visible failed cleanup and retry, independent duplication, deletion undo, grace-expiry cleanup, logged-out deletion queue, replacement at ten photos, and 360px/short-height layouts. Set `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH` and optionally `QA_URL`; no runtime/browser dependency is added to the app. Generated evidence is ignored under `artifacts/qa-supabase/`.

All 11 existing calendar/record/import/keyboard/mobile browser scenarios and the 11 mocked photo scenarios passed. The private-preview check also verifies images decode, not only that an `<img>` exists. Syntax/build/diff checks and public/secret/missing-pair build configuration checks passed. An independent UI/lifecycle review found two issues (restore timing and offline deletion), both fixed and approved. Mobile screenshots were inspected at 360×740 and 360×500; direct visual inspection substitutes for the unavailable visual-verdict skill.

**Continuation verification — 2026-09-17:** Fresh syntax checks, 32 Node tests, the ten-file build, 11 mocked photo browser scenarios, and all 11 existing browser regression scenarios passed. Created the separate Free Seoul SNS project and configured the owner, private bucket/RLS, and public Production/Preview environment variables. All ten build files were scanned against the actual administrative secrets; no secret value was included. The deployment input check excludes private context, environment files, local output, and agent files.

**Hosted checks:** Seven actual Supabase API/RLS checks pass: operator login, upload/list/private-byte download/session restore/delete, anonymous denial, second-user denial and inability to self-allowlist, cross-folder denial, and oversized/non-image rejection. Four browser checks using real Supabase pass: login/upload/save/reload/decoded preview, staged cancel/removal, publication followed by zero remaining photos, and simulated upload-failure retry. Both security and performance advisors report zero findings. The Vercel preview returns 200 for all ten files; nine are byte-exact, and HTML matches after accounting for the exact provider-added preview toolbar. Evidence and optional runners are retained in ignored `artifacts/qa-supabase-live/` and `artifacts/qa-supabase/preview-deployment.json`.

The hosted test helpers were strengthened to reject unexpected/network errors instead of treating them as authorization denials, and browser cleanup now checks the exact record folders and publication-before-delete ordering. All seven API and four browser checks passed again. The temporary QA account was signed out and removed; the database confirms one operator, one allowlist row, and zero photos. Temporary local administrative environment files were removed. A six-check local rehearsal of the production runner also passed; its HTTPS check was explicitly skipped on localhost and does not establish production success.

**Still required:** verify public signup is disabled, then release and verify production. See [supabase/README.md](supabase/README.md). Current production remains the previously verified 0.2.1 mobile release; the photo feature is not yet live. No new conversation or plugin reconnect is required.

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

For v0.2.1, syntax checks, all 20 Node tests, build and diff checks passed again. Five targeted browser regressions passed for the calendar, full library/schedule/publish flow, search/filters, dialog keyboard/duplication and mobile editing. Additional screenshots and assertions cover the compact 360px library and a 360px short-height editor with reachable save controls. Evidence is in ignored `artifacts/qa-v3/` and `artifacts/qa-v3/regression/`. Production v0.2.1 was verified at 19:02 Asia/Seoul: all seven file hashes matched, seeded text/URL survived save/reload, the name marker was absent, status filters stayed in one row and save remained reachable at 360×500.

All 20 Node tests, syntax checks, build and diff whitespace checks passed. The seven build outputs were compared byte-for-byte with source. An independent code review approved the final app/build changes.

Eleven Chromium browser scenarios passed across a full run and targeted reruns: calendar layout/icons, library→schedule→published persistence, legacy routes/calendar keyboard navigation, edit/delete/undo, global search/filters, dialog cancellation/duplication, mobile editing, backup validation/merge/recovery, stale-editor protection, failed-save preservation, and denied-clipboard text selection. Screenshots were inspected at 1440/768/360px, including eight records on one mobile date. The reruns resolved local navigation timing failures; no application JavaScript errors were observed. Google Fonts were blocked in the interaction suite to exercise the system-font fallback.

Detailed local evidence is retained in ignored `artifacts/qa-v2/` (`browser.mjs`, `browser-results.json`, `browser-results-targeted.json` and screenshots). Browser test records belong to isolated localhost contexts and are not shipped in `seed.js`. Production v0.2 was verified at 17:45 Asia/Seoul: HTTPS 200, seven exact file hashes, two seeded records, full seeded text/URL save/reload, desktop/mobile layouts and no application JavaScript errors. The live check used a fresh browser context and saved only an existing public seed record; it did not access the user’s browser storage. See `DEPLOYMENT.md`.
