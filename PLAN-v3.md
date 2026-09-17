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

## Open decisions

- User has no existing store and expects under 1 GB. Recommend Vercel Blob private storage on the current Vercel Pro team, with an authenticated server API and the official SDK. Provider/SDK choice has been requested and remains pending.
- Vercel project has no storage/auth environment variables. Local CLI management access is available; no store has been created.
- Pro Blob is usage-based, using monthly credits before on-demand billing, rather than the Hobby free 1 GB allowance. The official default-region table lists storage at $0.023/GB-month, with operations and transfer charged separately: https://vercel.com/docs/vercel-blob/usage-and-pricing
- Alternative: Supabase Free includes 1 GB file storage and Auth but requires another provider setup and pauses after a week of inactivity: https://supabase.com/pricing
- Photo limits and deletion retry semantics: finalize from verified storage constraints before implementation.

## Status

Mobile CSS and removal of the inert name decoration are implemented for v0.2.1. Targeted mobile checks, five existing UI regression scenarios, 20 Node tests and the static build pass. Mobile changes were merged through PR #3 and deployed; production verified at 19:02 Asia/Seoul with seven matching file hashes, existing seeded save/reload, absent name marker, single-row mobile filters and reachable save controls on a short viewport.

Photo implementation is pending the cloud/SDK selection. No cloud storage or photo deletion has been provisioned or verified yet.

The proposed photo API/lifecycle contract is retained in ignored `artifacts/qa-v3/cloud-contract.md`. It uses owner-only sessions, encoded record prefixes, unchanged v1 records and publication-save-before-delete ordering.
