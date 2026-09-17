# Supabase Free photo setup

Status: application code is prepared on `feat/supabase-photos`. No Supabase project, live bucket, administrator or production photo feature has been provisioned or verified yet. The user connected the Supabase plugin; its tools become available in a new conversation. Continue there with the steps below. Keep the existing Vercel `sns-kang88` deployment and browser-local records.

## Provision once

1. Use the connected Supabase account to list organizations/projects. Create an isolated **Free** project named `sns-kang88` (prefer Seoul if offered) in the user's Free organization. Do not upgrade a plan or reuse an unrelated database. Wait for project readiness.
2. Execute [setup.sql](setup.sql) with owner privileges. It creates a private `content-photos` bucket (6 MiB limit, JPEG/PNG/WebP), an explicit `photo_owners` allowlist and owner-folder Storage RLS. Authenticated users cannot add themselves to the allowlist. No public bucket, anonymous writes, UPDATE/upsert or service-role browser access.
3. Disable public Auth signups. Create the intended operator's email/password account through a trusted admin surface, with a strong password. Confirm the intended email/account if it cannot be established from the connected account. Do not commit credentials, put them in browser code, or send invitation emails without authorization. The app has no public registration UI and does not need SMTP for an already-confirmed operator account.
4. Add the administrator's actual Auth UUID through the SQL editor / trusted admin connection:

   ```sql
   insert into public.photo_owners (user_id)
   values ('REPLACE_WITH_AUTH_USER_UUID') on conflict do nothing;
   ```

5. Add public build variables to the existing Vercel project (Production and Preview for verification): `SUPABASE_URL=https://PROJECT_REF.supabase.co` and `SUPABASE_PUBLISHABLE_KEY=sb_publishable_...` (or legacy JWT **anon** key). Both are public configuration. Never use a secret or service-role key. The build rejects missing pairs, non-hosted URLs and secret keys. Do not copy `.env.local` into the public output.
6. Build and redeploy. `dist/cloud-config.js` contains only those public values; the source fallback disables photo controls until configured. CSP permits HTTPS requests to Supabase and local blob image previews. The app fetches private bytes with the user's JWT, then displays temporary blob URLs. It does not issue public/signed image URLs.

## Required live verification before release

- Anonymous clients cannot list, upload, read or delete photos.
- A second, unallowlisted Auth account cannot list, upload, read or delete the owner's objects or add an allowlist row; remove any temporary QA accounts after testing.
- The operator signs in and can upload a synthetic PNG, reload and download the same bytes. Its object path is `USER_UUID/BASE64URL_RECORD_ID/RANDOM_UUID.ext`. Arbitrary Unicode/slashes in legacy record IDs remain contained in one encoded folder.
- Bucket restrictions reject oversized and non-image uploads even with a valid user token.
- Save failure/stale local state performs no upload/delete. Cancelling file selection or staged removal leaves remote bytes unchanged.
- Publication commits the local record first; then verify the exact remote objects disappear. A simulated failure keeps the published record plus visible retry notice; retry removes the objects.
- Record deletion grace and undo preserve photos. An offline/logged-out deletion leaves a local cleanup intent; login later processes it. Clearing browser storage before cleanup can leave cloud objects; this is not a server job or guaranteed background deletion while the app is closed.
- Verify production HTTPS 200, all ten public files, existing calendar/CRUD/backup flows, 360px and short-height editor, and no app console/CSP errors. Only then merge/release and mark deployment verified.

## Local verification

`npm run check`, `npm test`, `npm run build` use Node only. The build does not automatically load `.env` files; inject the two environment variables through the deployment environment or shell without printing secrets.

The optional browser suite `tests/photo-browser.mjs` uses an externally installed Playwright through `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH`. Start a static server at the repository root; set `QA_URL` to it. The suite intercepts cloud configuration and all Supabase calls in isolated browser contexts. It proves client behavior, **not** hosted RLS or real provider availability. Evidence goes to ignored `artifacts/qa-supabase/`.

## Data and limits

Writing stays in the existing `sns-kang88:v1` localStorage schema. Auth uses tab-scoped sessionStorage. The local deletion journal uses `sns-kang88:photo-deletions:v1:PROJECT_URL`; it contains record IDs, owner IDs and the grace deadline, not image bytes or credentials. Unknown-owner deletion intents wait for the next allowlisted login. Other users' folders remain inaccessible through RLS. JSON exports include neither images nor this journal. Restoring the same IDs and signing into the same account reconnects photos still in storage. Deleted photos cannot be recovered from a writing backup.

Ten images per record is a client limit; RLS enforces authorization, and the bucket enforces MIME/per-file size. The app does not claim atomic multi-tab or multi-device photo transactions. Use one editing tab, complete uploads before leaving, and finish pending cleanup before clearing browser data.

Free currently includes 1 GB file storage and can pause after a week of inactivity. Project suspension or quota/network failure keeps local writing and shows a retryable photo error. No paid tier, paid automatic upgrade or third-party SDK is required. [Supabase pricing](https://supabase.com/pricing), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [private downloads](https://supabase.com/docs/guides/storage/serving/downloads), [API keys](https://supabase.com/docs/guides/getting-started/api-keys), [Auth sessions](https://supabase.com/docs/guides/auth/sessions).
