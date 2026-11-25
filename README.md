# AMP Learn

Private AMP Digital education platform: Next.js 16, TypeScript, Supabase Auth/Postgres/RLS, Instrument Sans and AMP burgundy. Phase 3 adds assigned student modules, lessons, private downloads, manual progress and signed Bunny player integration. Modules and lessons are dynamic; no educational content is seeded. **Local student video playback is enabled after live Bunny protection checks; other environments default to gated**; see [Bunny configuration](docs/BUNNY_SECURITY.md).

## Local use

Phase 4A audit and targeted fixes are complete locally. Security updates pin Next.js/ESLint config 16.4.6 and Zod 4.6.7. See [current audit results](IMPLEMENTATION_STATUS.md), [remaining release checks](docs/RELEASE_CHECKLIST.md) and [backup/recovery](docs/RECOVERY.md). No new migration or deployment is part of 4A.

Use Node 24 LTS from `/Users/kresimirperaic/Documents/amp-learn`:

```sh
npm ci
npm run dev
```

Open [local sign-in](http://localhost:3000/hr/login). The ignored `.env.local` contains this project's configuration. Never copy AMP Client Portal credentials. Restart the server after environment changes.

Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_TOKEN_AUTH_KEY`, `BUNNY_STREAM_DELIVERY_VERIFIED`, `APP_URL`. Only the first two are public. The secret Supabase key supports invitations and authorized Storage signing; the Bunny API key validates videos in library **820051**, and the distinct token key signs embeds. Leave the delivery gate unset/false until the documented live checks pass. No application Resend API key is required.

## Current Supabase upgrade

The user confirmed the Phase 1/2 migrations are applied to project **ozcjishpcyhoghqgpgau**. Phase 3 requires **no new migration**. No remote migration was run by implementation. Do not rerun or edit the applied 001/002/003 files.

003 preserves existing data, adds transactional admin operations and upload validation, fixes admin INSERT ... RETURNING visibility, revokes module/lesson DELETE, and lowers new attachments to **50,000,000 bytes or the lower bucket limit**. This cap supports remaining on Supabase Free. Keep both buckets private and check the project's global upload limit/quota as well. Covers remain capped at 10 MiB or a lower bucket limit. No paid upgrade is introduced.

## Auth configuration

Keep email/password enabled and public signups, anonymous login and unused providers disabled. `APP_URL` must be the trusted app origin, normally `http://localhost:3000`. Keep these exact redirects allowed:

- `http://localhost:3000/auth/confirm?locale=hr`
- `http://localhost:3000/auth/confirm?locale=en`

The existing invite and recovery templates in `supabase/setup` use the supplied RedirectTo plus token_hash and type. App invitations provide the correct callback. Dashboard-generated invitations need the same RedirectTo. Future production origins must be configured deliberately; avoid broad wildcard redirects.

Supabase sends Auth emails through its configured Resend SMTP (host `smtp.resend.com`, port `465`, username `resend`, restricted sending API key as SMTP password, verified AMP sender). There is no second email-delivery system. Do not change the Client Portal's SMTP or shared domain configuration.

For a completely new isolated installation only, apply 001 then 002 then 003 and use `supabase/setup/bootstrap-admin.sql` after manually creating the first confirmed Auth user. This existing AMP Learn installation already has its Super Admin; do not bootstrap again.

## Admin behavior

- `/hr/admin`: operational counts.
- `/hr/admin/modules`: create/edit/order/publish modules, private covers and lesson lists.
- `/hr/admin/lessons/[id]`: Tiptap content, title/status, Bunny UUID/embed validation and direct private resumable attachments.
- `/hr/admin/students`: searchable directory; individual profiles manage names, language, activation and explicit module access.
- `/hr/admin/invite`: invite new students or add selected module access to an existing identity. Partial provisioning retries reuse Auth accounts. Existing assignments and profile/activation state are preserved.

Use draft/published states to hide content. No module/lesson/student deletion or archive feature exists. Module publication never changes individual lesson statuses. Access does not expire. Select all captures the current IDs only; later modules are not automatically granted. Revocation and deactivation preserve progress.

Attachments upload directly to Supabase via TUS, with reservations, pause/resume, retry and storage-metadata verification. Reselect the same file to resume an interrupted upload; use Verify upload after uploaded bytes could not be finalized. Explicit Remove retains a pending record when deletion fails. Very old interrupted uploads may require removing the pending record and starting again. Download links are private signed URLs valid for five minutes. Replaced covers are retained; no automatic cleanup runs.

Bunny association accepts UUIDs and supported HTTPS embed URLs for the configured library. It calls the fixed server-side [Get Video endpoint](https://bunny.net/docs/api-reference/stream/manage-videos/get-video), checks returned library/identity and stores only UUID. Missing credentials do not block unrelated administration. Unlinking does not delete a video. Preview lesson opens the learning page for an active admin, including drafts. Video uploads remain in the Bunny dashboard.

## Student learning

`/hr/learn` shows only explicitly assigned published modules; `/hr/learn/modules/[id]` lists published lessons, and `/hr/learn/lessons/[id]` contains optional video, safe structured text, ready materials, manual completion/undo and previous/next navigation. English routes use `/en`. Lesson navigation collapses on mobile. Continue opens the first incomplete published lesson in admin order; completed modules remain revisitable.

Progress uses existing per-student records and only currently published lessons. Revocation, deactivation and unpublishing preserve history. New publication can lower a module's percentage. No watch-time or position tracking is added. Playback uses four-hour signed official embeds after server/RLS checks, with manual reauthorization on retry/expiry. See [Bunny configuration and release checks](docs/BUNNY_SECURITY.md) before enabling student playback.

## Security

Every administrative action verifies an active Super Admin. Database and Storage RLS enforce the same authorization. Session checks require a live matching Auth session. Only published assigned content is readable by students; draft modules and lessons remain hidden. Public signup is disabled outside the app as well. Auth email lookup, activation and transactional access changes use explicitly granted, guarded RPCs. Auth invitation/resend alone use a privileged client; normal content operations use the administrator's session client.

Storage allows exact reserved attachment uploads, module-prefixed cover uploads and authorized administrative reads/removals. No student direct signing/Storage read policy is provided. Student routes resolve an authorized, ready attachment and its exact path with the session/RLS client before narrow privileged signing. Downloads and covers use five-minute URLs; bytes travel directly from Storage. Already issued signed links remain usable until expiry.

## Development and verification

```sh
npm run typecheck
npm test
npm run lint
npm run build
```

`npm test` runs the actual migrations in isolated PGlite with simulated Supabase Auth/session/Storage schemas, plus pure validation, invitation orchestration, pagination and auth tests. `tests/http-smoke.mjs` checks a running production server, with `SMOKE_URL` set to its origin. It does not submit credentials or send email.

`node tests/admin-fixture.mjs` starts isolated browser QA on localhost:4300/4301, copying application source to a temporary directory without `.env` files. Add `--student` for assigned/unassigned/draft lessons, progress and a simulated downloadable attachment; then run `node tests/learning-http-smoke.mjs` for route checks. It supplies fake Auth/REST/Storage responses and fixture credentials; it is not a Supabase emulator or hosted integration test. No real email, Storage upload or Bunny playback is implemented by this fixture. Stop it with Ctrl+C when finished.

Read [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for the delivery report, actual test results and remaining manual acceptance. Live Supabase workflows need dedicated-account acceptance; private Bunny media delivery is a release gate.

Git remains an independent local `staging` branch with no remote or push/deployment. Confirm the actual AMP Learn repository URL before adding a remote. AMP Client Portal is strictly read-only. Reuse is limited to auth/client patterns, AMP styling, structured editor controls/schema and upload/invitation patterns; no unrelated portal business logic or secrets were copied.
