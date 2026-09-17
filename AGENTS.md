# SNS calendar workspace

Work in /Volumes/T9/01_Project/SNS. Reference ../Chinese-class/site is read-only design evidence. Follow DESIGN.md. No framework/runtime dependency is needed.

## Validation
Run `npm run check`, `npm test`, `npm run build`. UI changes require browser checks of calendar selection, record create/edit/reload, filtering, dialog keyboard controls, and mobile layout. Never claim automatic social posting; status is a manual record.

## Data
User-created records live in localStorage key sns-kang88:v1. Never commit private drafts or credentials. seed.js contains only two already-public posts. Validate imports atomically; keep existing data when parsing or saving fails. Date keys are YYYY-MM-DD; display today in Asia/Seoul.

## Deploy Configuration
- Platform: Vercel
- Project: sns-kang88
- Scope: kang88xxs-projects
- Production URL: https://sns.kang88.io
- Production branch: main
- Build: npm run build
- Output: dist
- Verification: HTTPS 200, all modules load, seeded post details + local CRUD persist
