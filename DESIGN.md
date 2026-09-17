# Design

## Source of truth
Active · 2026-09-17. Personal content calendar at sns.kang88.io. Reference: ../Chinese-class/site/styles.css, index.html, app.js; live chinese.study.kang88.io inspected. This is an adaptation of the user's Material 3 inspired interface, not a redesign of the reference.

## Brand
Calm, practical, personal. Korean interface; English and Chinese post content supported. Avoid hype, gradients, decorative imagery, fake analytics and fake scheduled posts.

## Product goals
Plan posting dates, keep full drafts, track publication per channel, collect ideas, export/restore data. Seed today's two genuinely published GIWA posts. Success: create/edit/filter/find a post, reload without loss, access publication URL, recover a backup.
Non-goals: social login, automatic posting, channel API integrations, invented engagement metrics.

## Personas and jobs
Kang: Korean Web3 PM working with Chinese and English-speaking clients. Plan posts across LinkedIn/X/Threads; adapt one topic by duplicating a post to another channel; retain multilingual writing; review weekly consistency.

## Information architecture
Calendar (default): week summary, month navigation, channel filters, seven-column month grid, selected-day details. Posts: searchable/filterable dated records. Ideas: unscheduled ideas. Settings: weekly target and local data backup/import.

## Design principles
Visible posting status separate from date. A planned date does not schedule a social-network publication. A single record belongs to one channel so statuses can differ. Preserve full text. Empty days stay empty. Private edits remain in this browser by default.

## Visual language
Reference tokens: white bg; #f8fafd surface-1, #f0f4f9 tonal, #e9eef6 elevated; #1f1f1f main text, #444746 secondary, #5f6368 muted; #0b57d0 primary, #d3e3fd selected. Green published, blue planned, amber draft, neutral idea. Radii 8/12/16/28 px. Roboto/Noto Sans KR with system fallback. Desktop rail 88px; sticky appbar 64px. Flat tonal cards with restrained borders and rare shadow. SVG stroke icons; no font-dependent icon names.

## Components
Appbar with brand/search/new-post. Side rail and mobile bottom nav. Stat tiles and weekly goal progress. Month toolbar, channel chips, calendar day buttons, status badges, record cards. Post editor dialog: title, channel, status, date/time, language, body, published URL, notes; save, duplicate, delete with undo. Native inputs and dialog.

## Accessibility
Semantic buttons and links, labelled fields, aria-current nav, aria-pressed filters, keyboard calendar arrows, dialog focus trap/restore, Escape close. Status uses text plus color. Visible focus, 44px touch targets, reduced-motion support. Invalid fields/errors announced; explicit save-failure feedback.

## Responsive behavior
Desktop month + right day panel. Below 1000px selected day panel under grid. Below 900px bottom navigation replaces rail, header stacks, main padding shrinks. Below 600px calendar cells show short channel marks/counts with full accessible names; never force a 7-column desktop card width. No horizontal page overflow at 360px.

## Interaction states
Local load is immediate. Empty calendar day offers add action; empty search offers reset. Save errors keep dialog open. Corrupt storage is not overwritten automatically. JSON import validates first and merges by stable ID with preview/confirmation; current data retained for failure. Deletion undo available. Data export is available without network. No auto-publish semantics.

## Content voice
Short Korean labels: 계획, 초안, 준비 완료, 발행 완료, 아이디어. Button '저장' never suggests network publication. '발행 완료' is a manual record status. Storage description explains browser-only persistence and backups.

## Implementation constraints
No framework or new runtime dependencies. Static ES modules, vanilla CSS/HTML, Node built-in tests. Vercel deployment with public seeded records only; no draft text in server logs. localStorage versioned JSON and validated import/export. User-entered text never interpolated unescaped into HTML; external links only http/https. Date arithmetic UTC date-only, display/context Asia/Seoul. No credentials committed.

## Open questions
- No blocking design questions. Initial storage is browser-local with backup/export. Chinese-class is reference-only; all project work belongs in /Volumes/T9/01_Project/SNS.
