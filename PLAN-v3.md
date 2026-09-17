# Photo attachments and mobile workflow

Requested 2026-09-17. Workspace: /mnt/j/01_Project/SNS.

## Scope and behavior lock

- Add photo attachments to unpublished library content; preserve photos until publication is recorded, then remove their cloud objects. Preserve the published text/date/URL record.
- Improve the mobile calendar/library/editor and remove the noninteractive bottom-left name decoration.
- Preserve existing record IDs, full text, v1 storage/import compatibility and failed-save/stale-state protection.
- Baseline: 20 Node tests, syntax checks and the seven-file build pass before editing. Existing browser regression scenarios are in ignored artifacts/qa-v2/.
- No edits to the Chinese-class reference. Reuse existing CSS/HTML; no speculative social posting integration.

## Implementation order

1. Inspect storage/access configuration and official cloud documentation. Resolve the intended cloud provider without delaying independent mobile work.
2. Update DESIGN.md. Use current screenshots as the visual baseline; tighten mobile spacing, controls and editor scrolling without reducing interactive targets below 44px.
3. Remove the inert name decoration and unused CSS. Verify navigation and all existing behavior remain available.
4. Lock attachment validation/lifecycle behavior with tests before changing persisted record handling. Photos must not be exposed through public unauthenticated upload/read/delete endpoints.
5. Implement attachment selection/preview/removal, persistence and authenticated cloud operations. Save the publication record before requesting photo deletion; failures must remain visible and recoverable. Do not claim cloud storage if it is not configured and verified.
6. Test upload/save/reload/publish/delete, cancellation, duplicate ownership, quota/network failures, import compatibility, and existing CRUD/keyboard flows. Inspect 360/390/768/1440px screens and a short mobile viewport.
7. Independent review, checks/build, PR/CI/merge and verified production deployment under existing project authorization. Keep setup blockers explicit.

## Supabase decision — accepted 2026-09-17

- User selected Supabase Free, under 1 GB photo storage. No paid tier or new npm dependency.
- Private `content-photos` bucket, email/password admin login, explicit owner allowlist and owner-folder RLS. Browser gets only public project URL/key; never secret/service-role keys.
- JPEG/PNG/WebP, 6 MiB per file, ten photos per record in the UI. Storage bucket enforces type and per-file size.
- Preserve v1 records; remote object paths use owner UID and encoded stable record ID. Photos are not embedded in JSON backups. Duplicates start without photos.
- Local selection and removal are staged until record save succeeds. Uploads retain random names across retries. Publication saves first, then deletes; unavailable cleanup stays visible and retries on login/online/manual action.
- Record deletion reserves a durable cleanup intent before local removal; 20-second grace exceeds the 16-second undo window. Restored records cancel cleanup. No cross-tab atomicity claim.
- Supabase account plugin connection confirmed by user; actual project provisioning and live authorization verification remain pending.

## Status

Mobile CSS and removal of the inert name decoration are implemented for v0.2.1. Targeted mobile checks, five existing UI regression scenarios, 20 Node tests and the static build pass. Mobile changes were merged through PR #3 and deployed; production verified at 19:02 Asia/Seoul with seven matching file hashes, existing seeded save/reload, absent name marker, single-row mobile filters and reachable save controls on a short viewport.

Supabase photo code and SQL are prepared. The 32 Node tests, 11 existing browser scenarios and 11 mocked photo scenarios pass; configuration rejects secret keys and incomplete public settings. Independent UI/lifecycle review approved after fixes. No new dependency or v1 record schema change.

The user connected Supabase, and plugin discovery confirms installed:true. Its project/SQL tools are not available in the active conversation; official plugin documentation requires a new conversation/session. Continue in this same workspace with the connected Supabase plugin, following `supabase/README.md`. Actual Free project creation, operator setup, RLS live checks, environment configuration and production photo release remain pending. Keep the feature PR in draft until those checks are possible.

The proposed photo API/lifecycle contract is retained in ignored `artifacts/qa-v3/cloud-contract.md`. It uses owner-only sessions, encoded record prefixes, unchanged v1 records and publication-save-before-delete ordering.
