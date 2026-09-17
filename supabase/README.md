# Supabase Free photo setup

Status: `sns-kang88` is provisioned on Supabase Free ($0/month) in Seoul, project ref `ijflzexbgrzhrjcoljja`. The user confirmed the existing `kang88xx's projects` organization and operator email. The private bucket, allowlisted operator, and Vercel Production/Preview configuration are in place. Seven hosted API/RLS checks and four real-provider browser checks passed on 2026-09-17. Security and performance advisors report no findings. Production photo release remains pending the Auth signup restriction and final deployment verification; PR #4 remains draft.

The existing Marketplace installation is `icfg_V0VEvC8LDLQsc6G3YwslZ1zb`, in Vercel scope `kang88xxs-projects`; its Supabase organization ID is `vercel_icfg_V0VEvC8LDLQsc6G3YwslZ1zb`. SNS resource `store_GZlQr3eJAgFTaBgs` was created through Vercel CLI 59.17.0 with plan `free`, region `icn1`, and the existing installation ID. The unrelated `kmir-db` is unchanged. Resource lookup in the CLI failed after creation; the authenticated Vercel API confirmed the resource and connected it to the existing SNS project using the same connection endpoint as the CLI. The current Supabase MCP does not expose Auth configuration operations; changing the signup toggle requires Studio login or a Management API credential. See [Vercel Marketplace integration](https://supabase.com/docs/guides/integrations/vercel-marketplace) and [Vercel integration CLI](https://vercel.com/docs/cli/integration).

## Remaining release gate

In [Authentication settings](https://supabase.com/dashboard/project/ijflzexbgrzhrjcoljja/auth/providers), turn off **Allow new users to sign up** and save. The public Auth settings endpoint still reported `disable_signup: false` at the last check. The user has been asked to complete this credential-gated step; verify the actual endpoint before release. The operator has already been created with confirmed email through the trusted Auth Admin API; no invitation email was sent. Its generated password is stored only in a private local file outside this repository.

Preview deployment is ready at `https://sns-kang88-m831zo4yg-kang88xxs-projects.vercel.app`. All ten files return HTTPS 200 through authenticated preview access. Nine match local `dist` exactly; the HTML matches with Vercel's preview toolbar script appended. After signup is disabled, release PR #4 and verify the production domain, public files, real photo lifecycle, existing records, and mobile controls. The temporary second QA account was signed out and deleted after the strengthened tests passed; a database check confirmed one operator, one allowlist row, and zero remaining photo objects. Temporary local administrative environment files were deleted. Retain the operator's private login file.

## Provision once

1. Use the confirmed organization to create an isolated **Free** project named `sns-kang88` (prefer Seoul if offered). The currently connected organization is Vercel-managed: use its existing Marketplace installation rather than assuming ordinary Supabase project creation is supported. Keep the Free plan, do not reuse an unrelated database, and wait for project readiness. Existing authorization/answers persist; do not ask again after the user specifies the organization and account.
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
