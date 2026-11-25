# AMP Learn — Bunny release gate

Status on 2026-11-25: **live access-control checks passed; local student playback enabled for acceptance testing**. Library: **AMP Learn / 820051**. The user configured protection in the library Security page; no separate Pull Zone edit was established. Implementation did not change Bunny settings.

## Live verification results

The supplied screenshot confirmed both **Embed view token authentication** and **CDN token authentication** enabled in Stream → AMP Learn → Security. It also showed Block direct URL file access enabled with an empty Allowed domains list. The user subsequently confirmed administrator playback works after the suggested localhost allowlist/direct-play adjustments.

The final read-only checks, using an existing finished video in library 820051, returned:

- Signed current iframe: 200. Unsigned, invalid-token and expired-token iframe: 403.
- Legacy unsigned iframe: 200 error page containing an explicit denial and no playlist source. This is not successful playback. Tested direct-play URL: 403.
- Unsigned HLS and tested MP4/original paths: 403 with and without an allowed localhost Referer.
- The official iframe's own signed HLS, child playlist and segment: 206 using the player origin as media Referer. Earlier signed-media checks using the parent localhost Referer returned 403; that did not model the iframe's actual media requests.
- Altered media signature: 403. The same real segment with its signature removed: 403 with both localhost and player Referer.
- The observed Bunny media expiry is approximately **36,000 seconds (10 hours)** after issuance. The application's embed expiry remains **4 hours**. Consequently a previously obtained media URL may outlive the embed and account/module revocation. This provider lifetime is documented, not claimed to be shortened by the app. Actual passage of the full ten-hour lifetime was not waited out.

These checks close the earlier unsigned playlist/segment bypass and verify official-player/CDN compatibility for the tested video. Full device/browser coverage, each optional rendition/path, hosted student revocation and download acceptance remain manual release checks. No deployment has occurred. The local gate is now true so the user can test actual student playback; new installations still default to false.

`node --experimental-strip-types tests/bunny-live-check.mjs` performs bounded read-only probes. It prints status codes, booleans and expiry duration, never URLs, signatures, keys or video titles. HTTP 403 for a guessed MP4/original path alone does not establish that that rendition exists. The account-level settings API remains inaccessible to the library key (401).

## Configure and verify in the Bunny dashboard

Keep the application gate closed while making and checking these changes. Confirm **Stream → AMP Learn (820051)** before any change; do not change another library or a shared zone.

1. **Security → Embed view token authentication**: enable the embed protection. Copy the key from **Security → Token authentication key** into the server-only `BUNNY_STREAM_TOKEN_AUTH_KEY`. The field may say “API key” but is distinct from the library management API key. The app hashes the security key, stored video UUID and Unix expiry with SHA-256 and uses the official signed embed URL. [Bunny embed token documentation](https://bunny.net/docs/stream/token-authentication).
2. **Security → Domains → Allowed domains**: include `localhost` for local testing. Entries are hostnames without a scheme. Later add only the actual approved application hostname. Keep **Block Direct URL File Access** enabled as an additional referrer restriction, not as the authorization boundary. Test after changes, as referrer restrictions can also block legitimate previews. No production domain has been selected. [Bunny security options](https://bunny.net/docs/stream/security-options).
3. **Security → CDN token authentication**: enable the library switch shown in the user's screenshot. Separate Pull Zone changes are unnecessary for the verified setup; API → Pull Zone → Manage is a troubleshooting location only. Library settings also expose this as `EnableTokenAuthentication`, distinct from embed `PlayerTokenAuthenticationEnabled`. Verify that the official embedded player supplies valid media tokens after enabling it. CDN protection covers playlists, segments, MP4, thumbnails and previews. HLS requires path-style authorization so child segments remain protected. [Bunny security overview](https://bunny.net/docs/stream/security), [HLS token guidance](https://bunny.net/docs/stream/security-options).
4. Review library delivery switches: keep **Allow Direct Play**, **MP4 Fallback**, **Expose Original Files** and **Early Play** disabled when unused. Their API field names are `AllowDirectPlay`, `EnableMP4Fallback`, `ExposeOriginals`, `AllowEarlyPlay`; Early Play enables original-file exposure. Labels/placement may vary; these switches were not read in the live dashboard. Disabling unused paths is additional defense and does not replace token enforcement. Do not enable DRM, premium encoding, AI or paid extras. [Bunny library settings reference](https://docs.bunny.net/reference/videolibrarypublic_update).

Do not replace the embed signing key with the CDN token key or management key. AMP Learn signs the iframe only; it does not construct HLS/MP4 URLs, proxy video, or distribute a CDN signing secret. The integration requirement is that Bunny's official player supplies and propagates CDN credentials compatible with the linked zone, including child segments and expiry. This compatibility passed the final live checks for the tested video. If the player returns 403 after CDN protection is enabled, keep student playback closed and resolve the library/player configuration with Bunny; do not turn off protection merely to make playback work.

## Acceptance before opening student playback

Use the existing Super Admin's lesson editor → **Pregled lekcije / Preview lesson** while the application gate is closed. Active admins can preview drafts; students cannot use that bypass.

- A fresh signed iframe must actually play an authorized video. Check play/pause, seeking, adaptive quality, speed, fullscreen and mobile; only encoded source renditions should appear. Autoplay is disabled. Use desktop browsers plus a real iOS/Android browser.
- With the same video, missing, altered and expired embed credentials must deny playback. Check both current and legacy player/iframe hosts and any direct-play URL exposed by the dashboard. Do not mistake a 200 error shell for a functioning player.
- In browser Network tools inspect actual HLS, variants and segment requests: valid CDN authorization must be present. Removing or changing it must fail **even with the application's allowed Referer**. Repeat for existing MP4 renditions, original and alternate delivery URLs. Missing files returning 404 do not prove protection of existing files. Test no referrer and an unrelated referrer as additional cases.
- Verify media token expiry as well as embed expiry; media URLs must not remain indefinitely usable. Document the actual CDN credential lifetime and any buffer/cache behavior. The observed CDN lifetime is ten hours; do not describe account revocation or the four-hour embed expiry as invalidating previously issued media URLs. If a shorter media lifetime is required, verify a supported Bunny configuration with the provider before production release.
- Revoke module access or deactivate the dedicated student: fresh playback requests, reload/retry and attachment requests must fail. Existing URLs/buffered or downloaded bytes cannot be recalled; see the limits below.
- Confirm authorized playback still works with all protections together. No custom player or video proxy should be needed.

Only after all applicable checks pass, set **`BUNNY_STREAM_DELIVERY_VERIFIED=true`** in AMP Learn's ignored server environment and restart the app. Unset or `false` denies student video credentials but leaves authorized lesson text, materials and manual completion available. This setting is an operator assertion, not an automatic provider monitor; reset it to `false` and retest after security changes. Run the dedicated student acceptance flow again after enabling it.

## Keys, expiry and limits

| Variable | Purpose |
| --- | --- |
| `BUNNY_STREAM_LIBRARY_ID=820051` | Only the AMP Learn library |
| `BUNNY_STREAM_API_KEY` | Server Get Video identity/library/status verification; library API page key |
| `BUNNY_STREAM_TOKEN_AUTH_KEY` | Server embed signature; Security token-authentication key |
| `BUNNY_STREAM_DELIVERY_VERIFIED` | Local true after live checks; new installations default false |

No account-wide Bunny key is required by the application. Keep all these variables server-side and never use a `NEXT_PUBLIC_` prefix for secrets. Existing Supabase URL/publishable key, server secret and `APP_URL` retain their Phase 2 roles; the server secret additionally signs private attachments/covers only after session/RLS authorization.

Embed URLs expire four hours after issue. The UI removes its iframe at expiry and shows a manual reload action; every reload rechecks the session, active profile, lesson, module, assignment, publication and current video metadata. No polling, automatic advance, automatic completion or playback-position tracking is added. Responses are private/no-store; URLs are not stored in the database or shared through application caches.

An issued URL is a bearer credential, not a user-bound session. A copied embed can remain usable until expiry, and the observed CDN credential lifetime is approximately ten hours. Buffered or downloaded bytes cannot be recalled. Revocation prevents new credentials immediately on the next authorized request; it cannot recall already delivered bytes. This is access control, not protection against screen recording or all copying. Cross-origin player-internal errors cannot all be inspected by AMP Learn; the official player and the app's reload action handle that boundary.

Streaming stays Bunny → browser. Attachment downloads stay Supabase Storage → browser with five-minute URLs. There are no new services, proxies, paid player options or subscriptions; existing Bunny delivery/encoding/storage and Supabase quotas still apply.
