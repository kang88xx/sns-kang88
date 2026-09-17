# Compact calendar and content workflow

User request, 2026-09-17. Current workspace: /mnt/j/01_Project/SNS. Previous macOS path: /Volumes/T9/01_Project/SNS.

## Scope and behavior lock
- Preserve v1 localStorage key/schema, existing records, IDs, timestamps, full multilingual body, backup merging, concurrency/recovery behavior.
- Baseline 15 tests passed. v2 now has 20 automated tests, including compact month sizes and YouTube/legacy status round trips.
- Native read-only UX review separates writer/reviewer ownership; implementation below reviewed for duplicate-channel icon counts, compatibility and hidden filter traps.

## Ordered changes
1. Done: Compact calendar with all dated records, one channel icon per record including same-channel duplicates, no visible titles in calendar cells, detail in selected-day panel, minimal complete calendar weeks, reduced cell height and accessible date labels/keyboard navigation.
2. Done: Oversized statistics/help copy replaced with a short actionable overview; duplicated empty-state CTAs and decorative tips removed while storage and manual-posting notices remain.
3. Done: Ideas replaced with Content Library for all unpublished records. Empty-date creation, full body storage, quick scheduling, publish-record action, copy, separate Published history, #ideas/#posts aliases and explicit all-content search scope are in place.
4. Done: YouTube added through the existing channel registry and reusable SVG channel icons.
5. Done: Desktop/mobile visual checks and 11 browser scenarios cover create→reload→schedule→published, compact months, duplicate icons, global search/filter reset, copy and permission fallback, preserved records, backup/recovery, stale edits, save errors and keyboard focus. Fixed stale search filters and the destination of undated duplicates made while scheduling.
6. Done: independent review, checks/build, PR #2 merge and Vercel production deployment. https://sns.kang88.io verified against all seven local source files, with seeded details and isolated-browser save/reload.

## Cleanup inventory
- Remove duplicated motivational copy, extra overview tiles, unused idea/tip/event-title CSS after UI replacement.
- Keep system font fallback, clipboard-selection fallback, corruption recovery and stale-write guard: grounded compatibility/safety boundaries with existing validation.
- No new dependencies or speculative posting integrations. No changes to Chinese-class reference.
- Build script keeps the same seven-file output whitelist and uses readFile/writeFile because Node copyFile hit EPERM on the mounted Windows workspace.

## Acceptance
- September 2026 has 35 cells; two posts render two icons; 4+ posts aren't silently omitted.
- Date row footprint reduced materially; full month + selected-day context usable without giant blank blocks.
- Saved undated YouTube content appears in library, survives reload, then same ID moves to calendar and published history through explicit actions.
- Existing published records and prior idea status import without loss.

## Current verification

- Automated: `npm run check`, `npm test`, and `npm run build` pass in this workspace.
- Visual evidence: `artifacts/qa-v2/calendar-1440.png`, `artifacts/qa-v2/calendar-360.png`, `artifacts/qa-v2/many-icons-360.png`, `artifacts/qa-v2/editor-360.png`.
- Browser evidence: `artifacts/qa-v2/browser-results.json` and `browser-results-targeted.json`; all 11 scenarios passed across the full run and targeted reruns after local navigation timing failures. No application JavaScript errors were observed.
- All seven build files match source bytes; independent final code review approved with no outstanding findings.
- Production verified 2026-09-17 at 17:45 Asia/Seoul: HTTPS 200, all seven files match local SHA-256, 35 September cells/two icons, full seeded text and URL survive save/reload. See DEPLOYMENT.md.
- Status: complete.
