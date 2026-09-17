# SNS calendar workspace

Work in /Volumes/T9/01_Project/SNS. Reference ../Chinese-class/site is read-only design evidence. Follow DESIGN.md. No framework/runtime dependency is needed.

## Validation
Run `npm run check`, `npm test`, `npm run build`. UI changes require browser checks of calendar selection, record create/edit/reload, filtering, dialog keyboard controls, and mobile layout. Never claim automatic social posting; status is a manual record.

## Data
User-created records live in localStorage key sns-kang88:v1. Never commit private drafts or credentials. seed.js contains only two already-public posts. Validate imports atomically; keep existing data when parsing or saving fails. Date keys are YYYY-MM-DD; display today in Asia/Seoul.

Normal import merges by ID, replaces only strictly newer updatedAt values, and keeps current settings. Explicit corrupt-storage recovery uses the backup records and settings. Storage events and a pre-save snapshot comparison detect stale state, but do not provide atomic locking across tabs. Do not document this as guaranteed conflict-free simultaneous editing.

## Project documentation
- [README.md](README.md): usage, browser-local storage, backup and development.
- [TESTING.md](TESTING.md): automated coverage and browser acceptance checks.
- [DESIGN.md](DESIGN.md): interface and interaction decisions.
- [PLAN.md](PLAN.md): delivery plan; deployment stays pending until verified live.
- [CHANGELOG.md](CHANGELOG.md): release history.

## Deploy Configuration
- Platform: Vercel
- Project: sns-kang88
- Scope: kang88xxs-projects
- Production URL: https://sns.kang88.io
- Production branch: main
- Build: npm run build
- Output: dist
- Verification: HTTPS 200, all modules load, seeded post details + local CRUD persist
