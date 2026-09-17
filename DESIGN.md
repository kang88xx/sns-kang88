# Design

## Source of truth
Active · 2026-09-17. Personal content calendar at sns.kang88.io. Reference: ../Chinese-class/site/styles.css, index.html, app.js; live chinese.study.kang88.io inspected. This is an adaptation of the user's Material 3 inspired interface, not a redesign of the reference.

## Brand
Calm, practical, personal. Korean interface; English and Chinese post content supported. Avoid hype, gradients, decorative imagery, fake analytics and fake scheduled posts.

## Product goals
Plan posting dates, keep full drafts and video scripts, track publication per channel, manage unpublished content in a library, export/restore data. Seed today's two genuinely published GIWA posts. Success: create/edit/filter/find content, reload without loss, access publication URL, recover a backup.
Non-goals: social login, automatic posting, channel API integrations, invented engagement metrics.

## Personas and jobs
Kang: Korean Web3 PM working with Chinese and English-speaking clients. Plan posts across LinkedIn/X/Threads/YouTube; adapt one topic by duplicating content to another channel; retain multilingual writing; review weekly consistency.

## Information architecture
Calendar (default): compact month/week navigation, channel filters, seven-column grid, selected-day details, upcoming dated content. Content Library: searchable/filterable unpublished records, including undated drafts and saved ideas. Published history: manually recorded published content. Settings: weekly target and local data backup/import.

## Design principles
Visible posting status separate from date. A planned date does not schedule a social-network publication. A single record belongs to one channel so statuses can differ. Preserve full text. Empty days stay empty. Private edits remain in this browser by default.

## Visual language
Reference tokens: white bg; #f8fafd surface-1, #f0f4f9 tonal, #e9eef6 elevated; #1f1f1f main text, #444746 secondary, #5f6368 muted; #0b57d0 primary, #d3e3fd selected. Green published, blue planned, amber draft, purple ready, neutral stored. Radii 8/12/16/28 px. Roboto/Noto Sans KR with system fallback. Desktop rail 88px; sticky appbar 64px. Flat tonal cards with restrained borders and rare shadow. Reusable SVG channel icons; no font-dependent icon names.

## Components
Appbar with brand, global search and content-save action. Side rail and mobile bottom nav. Actionable summary strip, month toolbar, channel chips, compact calendar day buttons, status badges, record cards. Editor dialog: title, channel, status, date/time, language, body, published URL, notes; save, copy body, duplicate, delete with undo. Native inputs and dialog.

## Accessibility
Semantic buttons and links, labelled fields, aria-current nav, aria-pressed filters, keyboard calendar arrows, dialog focus trap/restore, Escape close. Status uses text plus color. Visible focus, 44px touch targets, reduced-motion support. Invalid fields/errors announced; explicit save-failure feedback.

## Responsive behavior
Desktop month + right day panel. Below 1000px selected day panel under grid. Below 900px bottom navigation replaces rail, header stacks, main padding shrinks. Calendar month uses only the complete weeks needed for the visible month, so months can render as 28, 35 or 42 cells. Compact day cells show one channel icon per dated record, including repeated channels, with full accessible names on the date button. No horizontal page overflow at 360px.

## Interaction states
Local load is immediate. Empty calendar day offers add action; empty search offers reset. Save errors keep dialog open. Corrupt storage is not overwritten automatically. Normal JSON import validates first and merges by stable ID with preview/confirmation, replacing only newer records and retaining current settings. Explicit corrupt-storage recovery replaces records and settings with the validated backup; failed validation or writing retains stored data. Detected changes in another tab block an open editor until it is closed and reopened; the pre-save snapshot check is not an atomic cross-tab lock. Deletion undo available. Data export is available without network. No auto-publish semantics.

## Content voice
Short Korean labels: 보관, 작성 중, 준비 완료, 게시 예정, 발행 완료. Button '저장' never suggests network publication. '발행 완료' is a manual record status. Storage description explains browser-only persistence and backups.

## Implementation constraints
No framework or new runtime dependencies. Static ES modules, vanilla CSS/HTML, Node built-in tests. Vercel deployment with public seeded records only; no draft text in server logs. Build output uses an explicit static whitelist, including the photo modules and generated public cloud configuration. localStorage versioned JSON and validated import/export. User-entered text never interpolated unescaped into HTML; external links only http/https. Date arithmetic UTC date-only, display/context Asia/Seoul. No credentials committed.

## Open questions
- [ ] Supabase Free selected. Provision the private bucket, owner account and production environment, then verify live access.
- Existing writing remains browser-local with backup/export. Chinese-class is reference-only; current project work belongs in /mnt/j/01_Project/SNS.

## 0.3 work in progress — photos and mobile

The library will hold photo attachments alongside unpublished writing. Marking a record published retains its text/date/link and removes its cloud photos after the publication record is saved. Show that consequence in the editor; show recoverable progress/errors for upload and deletion. Photo access must be restricted to the owner. Supabase Free is selected. The editor adds a labelled photo area below the body, two columns on mobile and three on desktop. Photos require an allowlisted admin login in Settings. Pending photos have local previews; save uploads them, cancel discards selections. Removal is staged until save. Publishing warns that cloud photos will be deleted, with a persistent retry notice if cleanup fails. Record deletion keeps a 20-second photo grace period for the existing undo action. Duplication copies writing and starts a separate photo folder. Only photos use the cloud; original v1 record backups remain unchanged.

Reuse the existing surfaces, typography and navigation. Mobile spacing in the header, filters and library toolbar is reduced; status filters use one horizontally scrollable row with 44px touch targets. Date selection and the full editing form remain usable at 360px and short viewport heights, with save controls reachable and the form body scrollable. The inert bottom-left name decoration is removed. Preserve desktop layout and existing keyboard focus behavior.

## 0.2 revision — content workflow
The calendar shows one compact channel icon per dated record, including repeated platforms; titles/body are available in the selected-day panel. Use minimal whole weeks (28/35/42 cells). Calendar height follows occupied icon rows, with small empty cells rather than fixed tall blocks. Navigation becomes Calendar → Content Library → Published history → Settings. The library contains all unpublished content and starts new records without dates. Scheduling sets a date explicitly; recording publication is separate from actual SNS posting. Legacy #ideas/#posts routes map to the library, and stored idea IDs remain accepted with the visible label 보관. Global search covers both saved and published content and labels that scope. YouTube joins existing channels. Remove motivational/descriptive copy that repeats visible controls; keep storage/backups and manual-publication constraints.
