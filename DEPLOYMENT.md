# Production deployment

Verified 2026-09-17 (Asia/Seoul).

- URL: https://sns.kang88.io
- Repository: https://github.com/kang88xx/sns-kang88
- PR: https://github.com/kang88xx/sns-kang88/pull/1 (merged)
- Application merge: `543dd44c50408c11070c1ecbd3b9fa9f80de4c3f`
- Vercel project: `kang88xxs-projects/sns-kang88`
- Git production branch: `main`
- Build/output: `npm run build` → `dist/`
- Domain verification: configured correctly, attached to project, no conflicts.

## Verification

GitHub Actions passed syntax checks, 15 Node regression tests, and the static build. Native independent review approved after fixes; two external review passes informed additional fixes. Detailed private tool evidence is retained in ignored `artifacts/`.

Each of `index.html`, `app.js`, `core.js`, `store.js`, `seed.js`, `styles.css`, and `favicon.svg` returned HTTPS 200 from the custom domain and matched its local SHA-256. The live page displayed the two initial records. The LinkedIn record retained its full 1,890-character English/Chinese body after save and reload. No application console errors were observed; a pre-existing browser wallet extension injection error was excluded.

Local browser tests covered create/edit/reload/search, deletion undo, import merging, dirty-editor concurrency rejection, focus restoration, repeated Escape and skip-link behavior. Responsive layouts were inspected at 360px, 768px, and desktop size.

## Continued work

Use `/Volumes/T9/01_Project/SNS`. Changes merged or pushed to `main` automatically deploy through the connected Vercel Git integration. Keep drafts/credentials out of git. Only seven whitelisted app files are copied into the public build.

New user content is stored in the current browser. Optimistic storage conflict detection reduces stale writes but is not an atomic multi-writer database. Back up through Settings before clearing browser data or moving devices.
