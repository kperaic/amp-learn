# AMP Learn — Phase 4B deployment preparation

Prepared 2026-11-25 for `https://learn.ampdigital.hr`. See [deployment handover](docs/DEPLOYMENT.md) for environment scopes, exact Supabase production/local redirects, staging setup, Netlify import, Bunny hostname addition, Serverlab CNAME instructions and ordered smoke checks.

Changes: documentation and authorized phase scope only. Application code, build configuration, dependencies and local environment remain unchanged; no additional Netlify plugin/configuration was needed. No build, full suite, browser regression or dependency audit was repeated. Checked only deployment files, callback/origin handling, existing 4A blockers and official Netlify docs. Verified `.env.local` ignored; nonignored push-candidate scan found none of the three configured private keys without printing values.

Git is still unborn `staging`, no commits/tracked files/remote; `main` is not created yet. Exact private GitHub amp-learn clone URL is required. No URL was guessed, no commit/push/merge or deployment performed. Existing remote history must be verified before initial publication. Main is intended production and staging branch deploy is intended testing; a shared Supabase project is not isolated by a Git branch.

No pending migration from 4A/4B; existing 001/002/003 were user-confirmed applied, not rechecked or reapplied remotely. Outstanding release gates remain actual provider acceptance and backup/restore readiness from 4A. Actual Netlify staging host and CNAME target are obtained during manual setup, never guessed. Student delivery stays gated in each new environment until host verification.

**Deployment preparation complete; publication/setup and outstanding acceptance remain before production.** No external account, DNS or service was modified. **AMP Client Portal was not modified, accessed for database operations, deployed or reactivated.** The sections below are historical audit results.

---

# Historical Phase 4A audit and hardening

Implemented locally on **2026-11-25**. Status: **Ready for Phase 4B after listed manual verification**. No deployment, push, remote migration, real user/content mutation or email sending was performed. AMP Client Portal was not modified. Historical reports below describe earlier phases and do not override this status.

## 1. Issues found

| Severity | Finding | Result |
| --- | --- | --- |
| Critical — upstream package rating | Next.js 16.3.6 falls in published critical/high advisory ranges. The critical use-cache typed-array and SVG optimizer paths are not used here, so their exploitability was not demonstrated; this app does use Server Actions affected by a high-severity DoS advisory. | Next and matching ESLint config upgraded to 16.4.6. |
| High | Zod 4.6.5 predates the constrained-collection resource-exhaustion fix. | Upgraded to 4.6.7; install audit reports zero vulnerabilities. |
| High — operational | Local Git has no commits/remote, hence no Git recovery checkpoint. External source/data/video backups and actual plan retention are unknown. | Recovery runbook prepared; actual checkpoint, backups and restore acceptance remain prerequisites before production. |
| Medium | A stale module editor silently overwrote newer saves; module/invitation/student forms lacked the lesson editor's unsaved-change guard. | Atomic version comparison, conflict feedback and existing navigation guard applied. |
| Medium | Optional cover exceptions could fail a learning page; early delivery authorization exceptions escaped structured error handling. | Optional images fail softly; playback/download errors stay private and understandable. |
| Low | Production HTTP tests exposed global header overrides: immutable JS received no-store and callback no-referrer was overwritten. Cover cards repeated session checks during one render. | Headers scoped explicitly; request-scoped cover-session memoization. |
| Low | Remove-link remained usable while saving; completion state could survive a server refresh incorrectly; long labels could widen admin columns. | Save-time controls disabled, completion keyed to confirmed state, grid/label wrapping corrected. |

Primary sources: [Next Server Actions DoS](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r), [Next use-cache advisory](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr), [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). No exploit attempt was made against a live service.

## 2. Fixed

Security dependencies, stale module saves, unsaved module/invitation/student profile/access navigation, active-cover-upload navigation, error boundaries for delivery, optional-cover resilience, scoped caching/referrer headers and small responsive safeguards. Existing lesson white panel, previous/next buttons and highlighted My modules link were preserved. No new feature, design system, colors/fonts, payments, permanent deletion or infrastructure was added.

Module saves use the existing updated_at trigger and preserve user input on conflict. Copy edits before refreshing; a cover/order update can also advance the module version. Editor link controls cannot change content during save. Completion reflects refreshed server state. Cover session memoization is limited to the current React render, never a shared authorization cache; individual module RLS checks remain.

## 3. Verified

- Code/SQL review: live session ownership, active accounts, roles from profiles, publication and explicit assignment enforced in RLS/server operations. Privileged clients remain server-only and narrowly authorized. Students cannot list/sign/upload/remove Storage objects directly. Arbitrary client video IDs/object paths are not signing inputs. No open caller-supplied redirect or role-from-metadata path was found.
- Actual migrations tested in isolated PGlite with simulated Auth/Storage: unauthorized/direct table writes, drafts, cross-student reads/progress, role escalation, inactive/revoked/mismatched sessions, duplicate grants/progress, grant/revoke/regrant history, current-only select-all, atomic provisioning, reorder rollback, upload metadata and lower limits, fixed SECURITY DEFINER search paths/execution grants, stale module versions.
- Actual Next Server Action HTTP dispatch with simulated providers: admin save/conflict, malformed arguments, foreign Origin rejection, anonymous redirects, and student denial of eight admin actions (including attachment upload/sign/removal). Student Route Handler tests include forged IDs/paths, draft/unassigned content, gated playback and authorized downloaded bytes.
- Isolated browser QA: admin login/module save, two-tab conflict retaining typed text, unsaved navigation cancel/confirm, student profile/access save with dates, rich-text save; student navigation, completion/undo/progress, text-only lesson, video-unavailable fallback/retry with text still visible, EN switch and logout. Desktop, 390px mobile and 820px tablet inspected with no page overflow in checked admin/editor/student views. All real-device/Back/reload combinations were not tested.
- Previous live Bunny checks in this session were reused because signing/delivery configuration did not change. Signed iframe/HLS/variant/segment succeeded, unsigned/altered/expired embeds and stripped actual segment signatures failed; tested direct-play/alternate paths were denied. See [exact evidence and limits](docs/BUNNY_SECURITY.md). User separately confirmed real admin and student playback. These are distinct from simulated tests.

## 4. Database

**No new migration; no remote SQL executed.** Applied 001/002/003 were not edited. Current hosted orphan inventories, schema drift and backup state were not inspected with privileged credentials. Existing data/grants/roles and intentional deferred permanent deletion remain unchanged.

## 5. External configuration

Exact Supabase callbacks/templates/SMTP/bucket limits, Bunny protection and future Netlify environment requirements are in [RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md). Local configuration is unchanged. New environments keep the video gate false until delivery checks pass. Netlify compatibility was reviewed against official documentation, not verified by deployment. No private-key exposure was found locally and no rotation was performed.

## 6. Manual tests

Complete the [seven-part checklist](docs/RELEASE_CHECKLIST.md): real SMTP invite/reset/resend; hosted RLS and revocation/reactivation; editor/concurrent saves; TUS interruption/finalization/remove/quota behavior; mobile/long-session Bunny controls and actual alternative renditions/expiry/unauthorized origins; empty/multiple-module and keyboard layouts; independent backups and isolated restore. Production-host callback/cookie/cache/referrer tests belong to an authorized 4B preview.

## 7. Test results

- Full phase-boundary lint: **0 errors, 5 existing warnings** (three direct private-cover img elements, two dictionary default exports). Direct images intentionally avoid a privileged-image optimization proxy. Targeted lint for final header/HTTP test changes passed.
- TypeScript: **passed** standalone and in production builds.
- Full unit/integration suite run once: **65 passed, 0 failed** — 42 actual-migration/RLS tests in PGlite, 11 admin, 8 learning, 4 auth. Three new DB tests also ran as targeted development checks.
- Server Action HTTP: **15 admin/anonymous + 8 student passed**. Test assertions were adjusted to Next's proxy 307 and redirected Flight 200/303 responses; authorization assertions were retained.
- Student Route Handler HTTP: **18 passed** with simulated providers.
- Production build: passed; additional builds were justified by production HTTP tests exposing the cache/referrer header overrides. Final production HTTP: **17 passed**, including protected-route/API denials, HR/EN auth, invalid callback/locale, private cache/security headers, immutable static JavaScript and callback no-referrer.
- npm install audit after targeted updates: **0 vulnerabilities**. No blanket audit fix or unrelated dependency upgrade.
- Exact-value secret scan: three configured privileged keys absent from source/setup/tests/docs and built static client files; final rebuilt static scan also passed (33 files). `.env.local` remains ignored. Git contains no tracked files/commits/remotes, so no committed secret history exists to inspect. External logs/backups were not scanned.
- No hosted Supabase mutations, real SMTP messages or real Storage uploads/removals were performed in 4A. PGlite and HTTP fixtures are simulations, not live Supabase acceptance. Live Bunny evidence is from the earlier checks documented above.

## 8. Remaining risks and release blockers

Before production establish the actual backup locations, owner and successful restore described in [RECOVERY.md](docs/RECOVERY.md). Existing replaced/failed covers remain retained and can consume quota; reconcile inventory and approve cleanup separately. Size/MIME validation is not malware scanning. Concurrent module-access replacements remain transactional last-submitted selection, without a multi-admin merge UI.

Revocation stops **new** authorization, not existing bearer URLs: Storage links can last five minutes, embed tokens four hours, and observed Bunny media tokens approximately **ten hours**. No instant invalidation or screen-recording protection is claimed. Full elapsed media expiry, all real alternate renditions, physical mobile devices, SMTP/TUS and Netlify adapter acceptance remain unverified. No unresolved application authorization bypass was found, but local simulations do not establish live configuration correctness.

## 9. Production readiness

**Ready for Phase 4B after listed manual verification.** Local implementation/audit are complete; provider acceptance and backup readiness must be recorded before production. **Phase 4B has not begun. AMP Client Portal was not modified.**

---

# Historical Phase 3 report

Implemented locally on 2026-11-25. The student interface, authorization and signed-player integration are implemented. **Local student playback is now enabled after live Bunny access-control and signed-delivery checks passed.** The user confirmed real administrator playback; real student and mobile acceptance can now proceed. No production deployment has occurred.

The user confirmed Phase 2 and the existing migrations are applied. No new migration is required; applied 001/002/003 were not edited. No remote database/Auth changes, email, Bunny settings/video mutations, deployment or Git push were performed. AMP Client Portal was not modified. Phase 4 was not started.

## Lesson design follow-up

The lesson description now appears in a white rounded panel with a localized heading and readable spacing; empty descriptions omit the panel. Next lesson is a prominent burgundy action aligned right on desktop, with the next lesson title and arrow, and full width on mobile. Previous lesson remains quieter, and the completion button uses a secondary style. Verified visually on desktop and at 390px, with no horizontal overflow; the next action navigates correctly. Typecheck passed. These are presentation changes; playback and authorization are unchanged.

## Delivered student functionality

- My modules: ordered cards for explicitly assigned, published modules only, private covers, descriptions, published/completed counts, percentage, start/continue/revisit actions and a useful empty state. Continue uses the first incomplete published lesson in configured order, not watch history.
- Module detail: title, description, cover, current progress and ordered lessons. Draft lesson titles/metadata never enter student queries. Students may open lessons in any order; empty modules are supported.
- Lesson detail: desktop lesson navigation, collapsible mobile navigation, current/completed indicators, optional responsive official Bunny iframe, safe structured text, ready materials, completion/undo and previous/next links. Text-only lessons have no empty player; lessons without materials omit that section. Existing AMP typography/colors and HR/EN dictionaries are reused.
- Rich text: the existing bounded Tiptap schema is reused for a React allowlist renderer (paragraphs, H2/H3, bold/italic, lists, safe links, breaks/rules). No raw HTML is rendered. Invalid saved content yields a localized fallback.
- Manual completion: authenticated student's own ID only; insert-on-conflict does nothing, preserving the original completion date. Undo deletes only their matching record. Published lessons determine current counts; publication changes may change percentages without deleting history. Revocation/deactivation preserve progress, restored by regrant/reactivation. No autoplay, auto-advance, auto-completion, watch time or playback-position tracking.
- Admin lesson editor adds a preview link. Active Super Admins may preview drafts; this permission never comes from client claims. The existing Video ID label, access-date display and Active since behavior are preserved.

## Authorization and delivery

Every page/action resolves the authenticated active profile. Session-scoped Supabase queries retain the existing RLS checks for live Auth sessions, publication and explicit module access. Unauthorized IDs return a non-disclosing denial. Existing table/Storage grants were not broadened. Student progress writes use the same RLS boundaries and need no UPDATE grant.

`POST /api/learn/lessons/[id]/playback` accepts a lesson identifier, resolves its stored video itself, verifies metadata against the fixed library Get Video API and only then signs. Arbitrary client video IDs, module IDs, roles and user IDs are not authorities. The signature uses the separate embed token key and SHA-256 with a four-hour Unix expiry. Metadata is checked for every issuance; processing/missing/invalid/unconfigured video states fail safely. Responses are private/no-store; URLs are not persisted or cached across users. Retry and expiry require fresh authorization. The official player supports available encoded renditions, fullscreen, mobile and speed controls; actual device playback still needs live acceptance.

`GET /api/learn/lessons/[id]/attachments/[attachment]/download` first resolves the authorized lesson and ready attachment with the session/RLS client, then narrowly uses the server-only privileged Storage signer on the stored path for **five minutes**. Forged paths, pending records, cross-lesson IDs and drafts are denied. Private covers are likewise signed only after module authorization. No student bucket browsing/upload/removal/signing policy was added. File/video bytes go directly from their provider to the browser.

Revocation/deactivation prevents new signed credentials and new progress changes. It cannot recall already issued links or downloaded/buffered content. Embed URLs are bearer credentials valid for up to four hours; the observed Bunny media credential lifetime is approximately ten hours, so a previously obtained media URL may outlive the embed and account revocation. Download/cover URLs last five minutes. This is access control, not DRM or screen-recording protection.

## Bunny verification and local enablement

The user enabled both token switches in Stream → AMP Learn → Security, supplied a screenshot and confirmed admin playback after the domain settings adjustment. The final read-only checks verified signed iframe 200, unsigned/invalid/expired iframe 403, signed HLS/variant/segment 206 and altered signatures or stripped segment signatures 403. Unsigned segment denial was checked with both allowed localhost and player referrers. Unsigned HLS and tested MP4/original paths returned 403; the tested direct-play URL returned 403. The legacy unsigned iframe returns a 200 denial page without a media source, not functioning playback.

The official player's signed media source requires the player origin as Referer. The initial scripted request with the parent's localhost Referer did not model browser media delivery; the corrected check passed. The provider media expiry is about **10 hours**, while the application's embed token lasts **4 hours**. Existing media URLs may remain usable through their expiry after revocation. This limitation was reported; no claim of instant invalidation or DRM is made. The full ten-hour expiry was not waited out.

`BUNNY_STREAM_DELIVERY_VERIFIED=true` is now set only in ignored `.env.local`; the localhost server was restarted. This enables real student acceptance after the live access-control checks. Other environments default to false. No role, assignment, publication or RLS authorization was relaxed. Full mobile/device testing and hosted student revocation/download acceptance remain before any production release.

Exact configuration and results are in [docs/BUNNY_SECURITY.md](docs/BUNNY_SECURITY.md). Both required switches are on the library Security page; no separate Pull Zone edit was established or needed for the working setup.

Required environment remains the existing Supabase public URL/publishable key, server secret, APP_URL, Bunny library ID 820051, library API key and distinct embed token key, plus the explicit delivery-verification gate. Secret values were not copied into documentation. Restart after environment changes. No paid feature, service, media proxy or subscription was introduced; existing provider usage/quota costs remain.

## Phase 3 verification

- `npm test`: **62 passed**, zero failures: 39 PGlite actual-migration permission/integration tests, 8 learning/progress/token/authorization tests, 11 admin tests, 4 auth tests. Hosted Auth/session/Storage schemas are simulated for PGlite; video metadata/signing orchestration uses test doubles. No claim of live provider playback from these tests.
- New checks include idempotent completion without UPDATE grants, hidden attachment rows, inactive/revoked/draft denials, no signing after denied authorization or while the gate is closed, stored video identity only, four-hour token construction, processing/missing video errors and preserved publication-based progress.
- `node tests/learning-http-smoke.mjs`: **18 passed** against the isolated student fixture. Actual Next routes deny anonymous/cross-origin/unassigned/draft/mismatched/pending requests, ignore forged paths, return private/no-store responses and issue the authorized five-minute simulated Storage download. Hidden fixture titles are absent from student pages.
- Browser QA with the isolated fake Supabase service: assigned module only, start/continue, completion to 50%, undo to 0%, previous/next navigation, text-only display, HR/EN labels, unavailable-video fallback, ready attachment display and an actual direct download of fixture text. Desktop and 390px mobile layouts were inspected; mobile navigation collapses without horizontal overflow. A duplicate React key between player/completion was found, fixed and rechecked without console errors. Real video and provider storage were not used by this fixture.
- `npm run typecheck`: passed. `npm run lint`: zero errors, five warnings (three direct private-cover img uses and two existing dictionary default exports). Native private images keep signed content out of a shared image optimizer.
- `npm run build`: passed with the module/lesson pages and both delivery endpoints in the dynamic route list. The initial successful build was refreshed after resolving the final React effect lint finding; the final source was built successfully. A final browser check confirmed manual video retry returns its localized fallback without console errors.
- Production HTTP smoke on localhost:4302: **16 passed**, including anonymous denial for student module/lesson pages and both signing endpoints, private/no-store delivery responses, existing auth/admin routes and invalid callbacks/locales. No real credentials or email were submitted.
- Browser bundle scan: configured Supabase/Bunny private secrets absent from all 20 `.next/static` JavaScript files. The local student delivery gate is now open after live verification; `.env.local` remains ignored. Git remains local staging with no commits/remotes/push/deployment.
- Live Bunny verification was read-only and passed the final signed/unsigned delivery checks above. The user confirmed real admin playback. Hosted student completion/downloads/revocation, real device coverage and remaining Phase 2 hosted workflows still need acceptance.

## Manual end-to-end acceptance

1. Use dedicated AMP Learn test students in project ozcjishpcyhoghqgpgau. Assign one published module; verify other and draft modules/lessons are absent, including direct URLs. Test no-access and empty-module states.
2. Complete and undo text/video lessons; reload, sign out/in and use another device. Revoke/regrant access and deactivate/reactivate; confirm denials and restored historical progress. Publish/unpublish lessons and confirm counts change correctly.
3. Download real ready materials and private covers; verify pending/draft/other-module objects cannot be signed and no direct bucket access is granted. Retest after revocation. Hosted Storage signing remains a manual acceptance item.
4. The local gate is now open following Bunny verification. Test a real assigned student on desktop and mobile. Check missing/processing video, network failure, expiry/retry, seeking and speed controls; text/materials remain usable on video failure.
5. Verify long lesson titles, rich formatting, multiple/long attachment filenames and small screens with real content. Test inactive sessions and recovery/invite workflows without altering another application.

## Historical Phase 2 report

The report below records the earlier phase as delivered; its deferred Phase 3 statements and migration instructions are superseded by the current status above.

### Phase 2 Admin Experience

Implemented locally on 2026-11-24. The user confirmed Phase 1 migrations, Auth, SMTP/templates and the initial Super Admin are already configured. Phase 2 code is complete and locally validated; hosted rollout requires the new migration and the manual acceptance checks below. Phase 3 has not begun.

AMP Client Portal was used only as a read-only reference and was not modified. No remote migration, Auth mutation, email, video mutation, push or deployment was performed. One read-only Bunny library/video verification was performed against library 820051.

## Delivered administration

- Dashboard: total/active students, total/published modules and total lessons, with management shortcuts.
- Modules: create/edit name and description, optional private cover upload/replacement, draft/published status, transactional up/down ordering, lesson counts and assigned-student counts. No educational names are seeded and there is no course hierarchy.
- Module detail: ordered lessons, lesson creation and links to dedicated editors. Publishing a module preserves each lesson's status; unpublishing hides all child lessons through the existing student read rules. No module or lesson deletion UI exists, and their authenticated DELETE grants are revoked.
- Lesson editor: title/status, optional video, paragraphs, H2/H3, bold/italic, ordered/bullet lists, safe links, undo/redo and keyboard shortcuts, including Ctrl/Cmd+S. Tiptap JSON is bounded and validated before persistence. Text-only lessons work. Saves report success/error and compare updated_at to detect conflicting edits. Navigation/unload guards warn about unsaved content and in-flight uploads. No collaboration or version-history feature was added.
- Attachments: multiple files, direct private Supabase TUS uploads with 6 MiB chunks, progress, pause/resume and retry by reselecting the same file. Supported PDF/TXT/MP4/ZIP/DOCX/XLSX/JPG/PNG/WEBP; maximum 50,000,000 bytes or lower bucket limit. A reservation precedes upload; finalization checks the persisted storage object's size and MIME against that reservation. Pending rows remain available for verification/removal. Explicit removal first makes a row unavailable, then removes the object, then the row; failures retain retry information. Downloads use five-minute signed URLs. No file bytes pass through Next.js and no public URLs are created.
- Covers: private direct uploads, JPEG/PNG/WebP, at most 10 MiB or lower bucket limit, with persisted metadata/path validation. Replacements use unique object names and preserve older objects.
- Bunny: UUID or supported HTTPS iframe.mediadelivery.net/player.mediadelivery.net embed URL, normalized to UUID only. The server fetches only Bunny's fixed Get Video endpoint in the configured library and checks the returned identity/library. Check Video displays title, API processing status and duration. Replacing/unlinking never deletes the Bunny video. Missing credentials prevent new associations while other admin features and edits to an unchanged association still work. No iframe HTML, arbitrary URL fetch, upload, playback or signing implementation.
- Students: directory with name/email search, profile editing (names/language), activation/deactivation, invitations with module checkboxes, provider-supported resend for unconfirmed active accounts and password recovery. Auth email is read-only.
- Invitations: check selected module IDs and existing Auth identity before sending. A retry after partial provisioning reuses the same identity. Profile creation plus additive module grants run atomically. Existing student profiles, activation state, prior grants and progress are preserved. SMTP remains Supabase Auth's configured Resend transport; no separate mail service was added.
- Access: transactional replacement on a student profile, deduplicated grants, clear selection/select all current modules, including drafts. Selection sends explicit displayed IDs; modules created later are never automatically assigned. Revocation/deactivation preserve progress and assignments as applicable; regrant/reactivation restores access to preserved progress. Management queries fetch all pages instead of silently truncating at PostgREST's default row cap.
- HR/EN labels, Instrument Sans, established burgundy/neutral styles, responsive cards/forms and loading/error/empty states.

## Reuse from AMP Client Portal

Retained the Phase 1 adaptation of SSR/browser Supabase clients, cookie/session handling, auth callbacks, locale dictionaries, form patterns and AMP visual tokens. Phase 2 adapted the structured-document schema/editor controls from the monthly-plans editor, invitation/provisioning patterns and direct resumable-upload reservation/finalization patterns. The resulting code uses AMP Learn's module/lesson/student domain only. No portal monthly-plan entities, business migrations, credentials, deployment configuration or email infrastructure were copied.

## Authorization

Every exported admin server action calls requireAdmin, which checks an authenticated user, active super_admin profile and valid session. Ordinary content/storage operations use the user's RLS-scoped client. The secret client is restricted to Auth invitation/resend operations after authorization. New SECURITY DEFINER RPCs each recheck active admin access, fix search_path and have explicit grants. The directory and identity lookup expose Auth email only to active admins. Student/anonymous writes and private object reads remain denied. Static browser bundles were checked and contain none of the configured private keys.

## Migration to apply manually

Apply **only** `supabase/migrations/202611240003_admin_experience.sql` to AMP Learn project **ozcjishpcyhoghqgpgau**, after reviewing the target and script. It has NOT been executed remotely.

The already-applied 001 and 002 migrations were not edited and must not be rerun.

003 is data-preserving and compatible with the existing Foundation auth/read flows. It intentionally tightens two permissions: no authenticated module/lesson deletion, and a 50 MB (or lower existing) cap for new attachments. Existing content, accounts, assignments and progress are retained; older larger attachment rows are not rewritten. The migration adds transactional reorder/access/provisioning RPCs, admin directory/account lookup, upload limits/finalization, cover validation and a reservation-size trigger. It also amends admin SELECT policies so INSERT ... RETURNING can see a newly inserted module/lesson without depending on a STABLE helper's pre-insert snapshot. Student read conditions remain unchanged.

## Configuration

- SUPABASE_SECRET_KEY, BUNNY_STREAM_API_KEY and BUNNY_STREAM_TOKEN_AUTH_KEY are present in the ignored local environment. Values were not printed or copied. Token auth remains unused until Phase 3.
- Keep BUNNY_STREAM_LIBRARY_ID=820051. BUNNY_STREAM_API_KEY must be the API access key for this library. A live read-only check returned HTTP 200 for an existing video, matching its UUID/library and returning title/duration fields and status 4.
- Keep both Storage buckets private. 003 lowers the lesson-attachments bucket limit to at most 50,000,000 bytes and preserves a lower setting. Check the global Supabase limit as well; a lower global/project quota is still enforced by Storage. No paid upgrade is needed for this cap or was introduced.
- Keep public signups disabled, existing SMTP/templates and APP_URL=http://localhost:3000 for the normal local app. The app supplies `/auth/confirm?locale=hr` or `locale=en`; the existing templates append token_hash and type. Both exact redirect URLs must remain allowed in Supabase. No template or callback-route changes were required.
- Restart the normal local dev server after dependency/environment changes. Run npm ci if installing this checkout elsewhere.

References consulted: [Bunny Get Video](https://bunny.net/docs/api-reference/stream/manage-videos/get-video), [Bunny List Videos](https://bunny.net/docs/api-reference/stream/manage-videos/list-videos), [Supabase resumable uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads).

## Verification actually performed

- `npm run typecheck`: passed, including the final admin changes.
- `npm test`: **52 passed**, zero failures: 37 actual-migration PostgreSQL/PGlite permission/integration tests, 11 admin validation/invitation/pagination tests, and 4 auth policy/origin tests.
- Database checks include content create/edit and RETURNING, module/lesson reorder, stale/duplicate/cross-module reorder rollback, publication isolation, atomic access/provisioning, select-all excluding future modules, duplicate prevention, revocation/deactivation with preserved progress, all new RPCs rejecting students/inactive/revoked admins, directory restrictions, metadata finalization and lower upload limits. All three migrations are loaded in isolated PGlite with simulated Auth/session and Storage tables, not hosted Supabase.
- Invitation tests simulate identity lookup, delivery failure, first invite, orphaned identity retry and existing-student/admin cases. They do not send email or verify the real provider's resend behavior.
- `npm run lint`: zero errors, three warnings (direct private-cover img and the two existing dictionary default exports).
- `npm run build`: passed once at the phase boundary. All admin detail/editor routes appear in the production route list.
- Production HTTP smoke: **12 passed** against localhost:4302; public HR/EN auth pages, anonymous protected-route redirects, invalid callback type and unsupported locale. No credentials submitted or emails sent.
- Browser QA used an isolated temporary copy with an in-memory simulated Supabase HTTP service (`tests/admin-fixture.mjs`), never the real project. Verified simulated admin login, responsive dashboard, module creation/detail, lesson creation, editor save feedback and persisted rich text after reload. This exposed and fixed a Tiptap setEditable event that incorrectly marked untouched content dirty. Internal navigation reached a native confirmation that the browser automation could not dismiss; cancel/confirm/back behavior and the remaining student/upload screens still require manual browser acceptance. No claim of full end-to-end hosted verification is made.
- Live Bunny: read-only list/Get Video request succeeded; actual association persistence still needs the new Supabase migration and manual app test. No Bunny objects/settings changed.
- Configured private secrets are absent from `.next/static` JavaScript. `.env.local` remains ignored. Git remains local `staging`, no remote/push/deployment.

## Manual acceptance before Phase 3

1. Verify project ozcjishpcyhoghqgpgau and apply only 003; sign in as the existing Super Admin.
2. Create two modules and several lessons, reorder and reload, edit names/descriptions, upload/replace a cover, toggle publication. Confirm draft lessons stay draft when their module is published and all lessons disappear from student queries when it is unpublished.
3. Exercise all editor controls, links and keyboard shortcuts. Save/reload a text-only lesson. Test cancel/confirm on sidebar navigation, browser Back, logout and reload with unsaved changes. Open two editor tabs and verify a stale save reports a conflict without overwriting newer content.
4. Associate a real library-820051 UUID and an allowed embed URL, verify metadata, replace/unlink it, reject foreign-library/host/iframe input. Confirm removing the reference leaves the Bunny video intact.
5. Upload multiple supported files, including a file over 6 MiB; pause/resume, disconnect/reselect, reload a pending upload, verify an uploaded pending row, download and explicitly remove. Test the 50 MB boundary, a lower bucket cap and project quota errors. Confirm failed removal remains retryable. Supabase TUS and cloud metadata behavior have not been live-tested.
6. Invite a dedicated test address with draft and published module access; verify actual SMTP delivery/callback/password setup. Test partial provisioning retry with the same email, resend for an unconfirmed account if the provider permits it, and recovery for a confirmed one. Existing-account invites must add access without changing the Auth UUID or deleting previous grants.
7. Search/edit a student, select all, save, then create another module and confirm it is unassigned. Revoke/regrant and deactivate/reactivate a student with existing progress; verify that history remains. Inspect direct Supabase queries with student credentials for unauthorized/draft content and denied admin mutations.
8. Check HR/EN labels and desktop/mobile layouts, especially editor toolbar, student access controls and long filenames. Full student learning/playback/progress UI is intentionally absent until Phase 3.

## Limitations and remaining gates

003 is the only rollout prerequisite in code/schema. Real Supabase invitations, resend rate limits, direct TUS uploads, removal and hosted RLS acceptance remain manual checks. Provider resends may be rejected; the interface reports this and exposes recovery. Existing signed downloads remain valid for up to five minutes after revocation/removal, and downloaded bytes cannot be recalled. Metadata validation verifies stored size/MIME, not malware or deep file-content inspection. Replaced/failed cover uploads are retained; there is no automatic cleanup job. Interrupted TUS uploads beyond the provider's resumable lifetime may require explicitly removing the pending record and starting again. Native navigation dialogs were not fully verified by automation. No paid service, deployment, secure playback, student learning/progress UI or other Phase 3 feature was added.

## Follow-up — 2026-11-25

The admin student directory and individual profile now display Active since from the existing Auth email_confirmed_at value returned as confirmed_at. It means first account confirmation/invitation acceptance, not the last administrator reactivation. Pending invitations have no activation date; inactive accounts retain their original date. Dates use Europe/Zagreb consistently in HR/EN. No schema migration or remote data update is required.

The student My modules page remains the Phase 1 placeholder. Its empty appearance is not evidence of missing module assignments. The user clarified that student module display belongs to Phase 3, so the briefly added module listing was reverted. Lesson navigation, playback and progress UI also remain deferred.

Validation: TypeScript and 41 auth/RLS tests passed during this follow-up. No remote accounts, assignments or content were modified.

Admin follow-up: each student's directory row now lists their assigned modules with access dates, and profile module checkboxes show the persisted grant dates. This uses existing module_access.granted_at through the administrator's session/RLS client. Draft assignments are included. Existing grant dates remain unchanged when saving or adding other access; revocation followed by regrant shows a new date for that current assignment. No migration, historical access log or student learning UI was added.

The assignment-date follow-up passed TypeScript and targeted ESLint checks for all changed admin components/pages. Hosted data was not modified.
