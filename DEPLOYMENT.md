# Production deployment

Version 0.3.0 verified 2026-09-17 (Asia/Seoul).

- URL: https://sns.kang88.io
- Repository: https://github.com/kang88xx/sns-kang88
- PR: https://github.com/kang88xx/sns-kang88/pull/4 (merged)
- Application merge: `130a9bd906e4b1f856373841cd62495debf481ad`
- Vercel project: `kang88xxs-projects/sns-kang88`
- Git production branch: `main`
- Build/output: `npm run build` → `dist/`
- Production application deployment: https://vercel.com/kang88xxs-projects/sns-kang88/HrWkiFcCRYaKjCER25zRg46EWB92
- Supabase: `sns-kang88` / `ijflzexbgrzhrjcoljja`, Free, Seoul; private `content-photos` bucket

## Verification

GitHub Actions passed syntax checks, 32 Node regression tests and the static build for both the PR and merged application. Vercel reported successful production deployment. Before release, all 11 existing browser regressions, 11 mocked photo scenarios, seven hosted API/RLS checks, and four real-provider photo browser scenarios passed.

Six production checks passed against `https://sns.kang88.io`: HTTPS 200; exact SHA-256 matches for all ten public files (`index.html`, `app.js`, `core.js`, `store.js`, `seed.js`, `styles.css`, `favicon.svg`, `photos.js`, `photo-ui.js`, `cloud-config.js`); full seeded LinkedIn body/URL save and reload; synthetic local create/edit/delete; calendar/filter/Escape/focus behavior; and reachable save controls at 360×500. The tests used isolated browser contexts and did not access the user's browser-local drafts. No application JavaScript, CSP, or same-origin resource errors were observed.

Four production photo checks passed with the actual allowlisted account: login/upload/save/reload with decoded private previews; staged cancellation and removal; publication saved before remote deletion with exact empty photo folders; and a recoverable upload-failure retry. Test photos were removed. The temporary unauthorized test account was signed out and deleted; only the operator remains.

Supabase public signup is disabled. The setting was saved through the existing Windows Chrome session and verified through the public Auth settings endpoint; a synthetic signup receives HTTP 422 `signup_disabled`. Security and performance advisors report zero findings. The static build contains only the public URL/key; all ten build files were scanned against administrative secrets. Local context, credentials and agent files are excluded from deployment input. See [Supabase setup](supabase/README.md) for bucket policies, backup limits and maintenance.

Production evidence is retained in ignored `artifacts/qa-supabase-live/prod-public-results-qa-20260917113100-c156ff1a.json`, `artifacts/qa-supabase-live/live-browser-results-qa-20260917113100-ee1fc3ea.json`, and `artifacts/qa-supabase/auth-settings.json`. Preview HTML included Vercel's toolbar; production HTML matched the build exactly.

## Previous release

Version 0.2.1 was verified on 2026-09-17 at 19:02 Asia/Seoul through PR #3, application merge `99172c198fc074b4746a4ee36e78e79827d1039a`. Its mobile checks confirmed the absent inert name marker, single-row filters, and short-height editor controls. Evidence remains in ignored `artifacts/qa-v3/`.

Version 0.2.0 was verified on 2026-09-17 at 17:45 Asia/Seoul through PR #2, application merge `fa79cf5e04348279519e668fcdf776eeb787d2c7`. Its 20 Node tests and 11 browser scenarios passed; evidence remains in ignored `artifacts/qa-v2/`.

Version 0.1.0 was deployed and verified on 2026-09-17 via PR #1, application merge `543dd44c50408c11070c1ecbd3b9fa9f80de4c3f`, followed by deployment documentation commit `617f82b3c9df2ac7d59849db542b1379d75fb475`. Its 15 Node tests and original browser checks passed; historical evidence remains in ignored `artifacts/`.

## Continued work

Use `/mnt/j/01_Project/SNS` in the current WSL workspace (previous macOS path: `/Volumes/T9/01_Project/SNS`). Changes merged or pushed to `main` automatically deploy through the connected Vercel Git integration. Keep drafts/credentials out of git. Only ten whitelisted app files, including generated public cloud configuration, enter the public build.

New user content is stored in the current browser. Optimistic storage conflict detection reduces stale writes but is not an atomic multi-writer database. Back up through Settings before clearing browser data or moving devices. Publication status is a manual record, not automatic SNS posting.
