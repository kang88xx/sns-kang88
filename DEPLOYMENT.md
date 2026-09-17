# Production deployment

Version 0.2.0 verified 2026-09-17 at 17:45 Asia/Seoul.

- URL: https://sns.kang88.io
- Repository: https://github.com/kang88xx/sns-kang88
- PR: https://github.com/kang88xx/sns-kang88/pull/2 (merged)
- Application merge: `fa79cf5e04348279519e668fcdf776eeb787d2c7`
- Vercel project: `kang88xxs-projects/sns-kang88`
- Git production branch: `main`
- Build/output: `npm run build` → `dist/`
- Production deployment: https://vercel.com/kang88xxs-projects/sns-kang88/Y5FoPRsGR2g2faEQX1zNkQdXwSE3

## Verification

GitHub Actions passed syntax checks, 20 Node regression tests and the static build for both the PR and merged application. Vercel reported successful production deployment. Independent final code review found no outstanding issues.

The HTTPS homepage returned 200. Each of `index.html`, `app.js`, `core.js`, `store.js`, `seed.js`, `styles.css` and `favicon.svg` returned 200 and matched its local SHA-256. The live September calendar displayed 35 cells with one icon for each of the two initial records. The LinkedIn record retained its full 1,890-character English/Chinese body and public URL after save/reload in an isolated browser context. No application JavaScript or same-origin resource errors were observed. Desktop 1440px and mobile 360px screenshots were inspected with no horizontal page overflow.

Local browser QA covered 11 scenarios, including create/edit/reload, scheduling and publication history, duplicate icons, global search/filter reset, deletion undo, import/recovery, dirty-editor conflict rejection, failed saves, clipboard denial, keyboard controls and responsive layouts. Intermittent local navigation failures required targeted reruns; all scenarios subsequently passed. Details and limits are recorded in TESTING.md. Tool evidence, hashes and screenshots are retained in ignored `artifacts/qa-v2/`.

## Previous release

Version 0.1.0 was deployed and verified on 2026-09-17 via PR #1, application merge `543dd44c50408c11070c1ecbd3b9fa9f80de4c3f`, followed by deployment documentation commit `617f82b3c9df2ac7d59849db542b1379d75fb475`. Its 15 Node tests and original browser checks passed; historical evidence remains in ignored `artifacts/`.

## Continued work

Use `/mnt/j/01_Project/SNS` in the current WSL workspace (previous macOS path: `/Volumes/T9/01_Project/SNS`). Changes merged or pushed to `main` automatically deploy through the connected Vercel Git integration. Keep drafts/credentials out of git. Only seven whitelisted app files are copied into the public build.

New user content is stored in the current browser. Optimistic storage conflict detection reduces stale writes but is not an atomic multi-writer database. Back up through Settings before clearing browser data or moving devices. Publication status is a manual record, not automatic SNS posting.
