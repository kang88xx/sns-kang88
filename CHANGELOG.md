# Changelog

## 0.3.0 — 2026-09-17

- Add private photo selection, previews, download and staged removal with Supabase email/password admin access.
- Preserve v1 browser-local records and commit writing before photo uploads or publication cleanup.
- Keep failed uploads retryable under the same ID; show persistent cloud-cleanup errors.
- Keep photos during record deletion undo grace, with a local retry journal.
- Add private-bucket/allowlist RLS setup, public-only build configuration and REST/browser tests without new dependencies.
- Provision the isolated Supabase Free Seoul project and private bucket; verify owner access, unauthorized denial, size/type restrictions and the real photo lifecycle.
- Resolve the allowlist RLS performance warning and exclude local context/generated files from deployment input.
- Disable public signup, configure Vercel environments, merge PR #4 and deploy to sns.kang88.io.
- Verify all ten production files, existing record/keyboard/mobile behavior and real photo upload/reload/publication cleanup.

## 0.2.1 — 2026-09-17

- Tighten mobile header, library and filter spacing while retaining 44px controls.
- Keep mobile status filters in one horizontally scrollable row.
- Keep editor save/cancel controls reachable on short mobile screens with safe-area-aware dialog sizing.
- Remove the noninteractive bottom-left name decoration and its unused styles.

## 0.2.0 — 2026-09-17

- Replace Posts/Ideas navigation with Content Library and Published history while keeping legacy `#posts`/`#ideas` aliases.
- Compact month calendars to the complete weeks needed for each month and show one channel icon per dated record.
- Add YouTube as a channel and keep legacy idea records compatible with the visible `보관` status label.
- Add global all-content search, body copy actions, quick scheduling and manual publish-record actions.
- Keep browser-local storage, validated backup/import, corrupt-storage recovery and stale-edit warnings unchanged.
- Update the build script to copy the same seven static output files with read/write operations on the Windows-mounted workspace.
- Fix stale channel filters in global search, undated duplicate navigation and body-copy permission fallback.
- Deploy to sns.kang88.io and verify exact app files, seeded content and browser-local save/reload.

## 0.1.0 — 2026-09-17

- Add a personal monthly/weekly content calendar with channel and status filters.
- Keep full multilingual drafts, ideas, publication links, and preparation notes.
- Add duplicate, delete/undo, weekly goals, and validated JSON backup/import.
- Keep corrupt data intact, report save failures, and reject detected stale edits across tabs.
- Adapt the owner's Chinese-class UI and responsive navigation.
- Start with today's two public LinkedIn/X records and deploy to sns.kang88.io.
