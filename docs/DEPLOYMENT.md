# AMP Learn — Phase 4B deployment handover

Prepared 2026-11-25. No code/build changes were necessary. No build, regression suite, dependency audit or deployment was repeated. This document does not authorize external changes.

## Git prerequisites

Local repository: `/Users/kresimirperaic/Documents/amp-learn`, unborn `staging`, no commits, tracked files or remote. `main` does not exist locally yet. The private GitHub repository exists according to the user, but its **exact owner/repository clone URL is missing**. No GitHub connector or `gh` CLI is available to resolve it. Supply that URL; do not substitute the Portal remote.

Before first push, review the file list and make a local initial checkpoint on staging, then create main at the approved release commit. Review the actual remote's existing history before connecting branches; if it already has commits, reconcile them without force-pushing. Required remote command after verifying the URL: `git remote add origin <EXACT_AMP_LEARN_CLONE_URL>`. The angle-bracket value is a placeholder, not an executable command. Verify with `git remote -v` and a read-only remote history check. Publish staging and main only with authorization; main is production, staging is testing. Neither was pushed here.

`.env.local` is ignored; `.env.example` contains public identifiers and empty private-key fields. No tracked files or history currently contain secrets. An exact-value scan of nonignored push candidates found none of the three configured privileged keys. Recheck the staged set before the initial commit/push; do not include dumps or exported environment files.

## Environment variables

Enter these in Netlify Project configuration → Environment variables, **before the first build**. Public values need Builds; runtime values need Functions and Builds (or all applicable scopes if scoped controls are unavailable). Never mark privileged credentials public or expose them to untrusted Deploy Previews.

| Variable | Production value/source |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | `https://ozcjishpcyhoghqgpgau.supabase.co` |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Existing Learn publishable key |
| SUPABASE_SECRET_KEY | Existing Learn private secret key |
| BUNNY_STREAM_LIBRARY_ID | `820051` |
| BUNNY_STREAM_API_KEY | Existing library API key |
| BUNNY_STREAM_TOKEN_AUTH_KEY | Existing separate token-authentication key |
| BUNNY_STREAM_DELIVERY_VERIFIED | `false` initially; `true` only after new-host delivery verification |
| APP_URL | `https://learn.ampdigital.hr` |

Set Node **24** in Netlify's build dependency settings (or platform setting `NODE_VERSION=24`); this is a hosting setting, not another application variable. No application Resend key is needed. Keep Supabase's existing SMTP configuration.

Production context gets the production APP_URL. The individual staging branch gets its **actual stable HTTPS branch URL copied from Netlify**, without a trailing slash, as APP_URL. Use that same host for staging callbacks/Bunny. Do not use a deploy-specific hash URL or guessed site slug. Local `.env.local` remains `APP_URL=http://localhost:3000` and was not changed.

Staging can use the existing Learn project/library only with the explicit understanding that it shares real accounts/content; a Git branch does not isolate data. Use dedicated test records and no destructive staging tests. No new paid environment is introduced.

## Netlify setup

1. After the approved Git publication, choose **Add new project → Import an existing project → GitHub**. Select the verified private **amp-learn** repository, never Client Portal. Production branch: **main**.
2. Accept Next.js detection. If manual fields are required: base directory is repository root, build command `npm run build`, publish directory `.next`, Node 24. Use the current automatically managed Next.js adapter. No static export, `out` directory, custom functions directory or manually installed legacy plugin.
3. Enter production environment variables before clicking Deploy. If the import flow offers deferred setup, finish configuration first. Trigger one initial deployment; use the resulting project's settings to configure the custom domain and staging. Keep student video issuance gated until host verification; an active admin can preview playback while the gate is false.
4. Project configuration → Developer settings → Continuous deployment → Branches and deploy contexts → Configure → **Let me add individual branches → staging → Save**. Assign staging context variables, push only approved staging changes, and copy its actual stable branch URL once generated. Avoid unnecessary production rebuilds. After host tests pass, setting the delivery gate true requires one new deployment for that context.

The current App Router/server runtime remains intact; video bytes continue directly from Bunny and attachment bytes directly from Supabase Storage. No `netlify.toml` or dependency was added because detection/UI settings suffice. Sources: [Netlify Next.js support](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/), [individual branch deploys](https://docs.netlify.com/deploy/deploy-types/branch-deploys/).

## Exact Supabase URL configuration

In **amp-learn / ozcjishpcyhoghqgpgau → Authentication → URL Configuration**:

Site URL: `https://learn.ampdigital.hr`

Redirect allowlist:

```text
https://learn.ampdigital.hr/auth/confirm?locale=hr
https://learn.ampdigital.hr/auth/confirm?locale=en
http://localhost:3000/auth/confirm?locale=hr
http://localhost:3000/auth/confirm?locale=en
```

For staging, append `/auth/confirm?locale=hr` and `/auth/confirm?locale=en` to the exact staging origin copied from Netlify, and allow those two URLs. Keep Site URL on production; staging actions supply their own APP_URL as RedirectTo. No wildcard needed. Existing templates append token_hash and invite/recovery type, which `/auth/confirm` verifies before redirecting to localized set-password. Preserve SMTP/templates. Dashboard invitations must also specify the intended environment's exact RedirectTo.

No pending migration is known: user confirmed 001/002/003 applied; 4A/4B add none. Do not rerun `202611240001_foundation.sql`, `202611240002_private_storage.sql`, or `202611240003_admin_experience.sql` on this existing project. No remote schema check or SQL execution was performed in 4B.

## Bunny and custom domain

In library **820051 → Security → Allowed domains**, add `learn.ampdigital.hr`. Preserve `localhost` for local testing; add the actual staging hostname if staging playback is required. Hostnames only, no scheme/path/port. Preserve all existing token/direct-access protection, encoding and player settings. No separate Pull Zone changes. Follow the outstanding delivery gates from 4A; already issued media links can remain valid about ten hours after revocation.

In Netlify Domain management, add **learn.ampdigital.hr** to this Learn project and use it as primary. Copy the **exact DNS target Netlify displays**. In Serverlab cPanel → Zone Editor → ampdigital.hr → Manage, create CNAME for `learn` pointing to that target. If a conflicting record already exists at `learn`, inspect it before replacing it. Do not change apex, portal, MX/TXT/email records or nameservers. No WordPress installation or hosting directory is required. Return to Netlify, verify DNS and wait for its HTTPS certificate before auth acceptance. [Netlify external-DNS instructions](https://docs.netlify.com/manage/domains/configure-domains/configure-external-dns/)

## Ordered manual release checklist

1. Supply exact GitHub URL; review/commit files, establish main/staging and approve initial publication. Establish backups/restore readiness from RECOVERY.md.
2. Create the Netlify Learn project, configure branch/environment/build settings and perform the initial deployment as above. Obtain the actual staging URL and DNS target.
3. Connect only learn.ampdigital.hr in cPanel/Netlify and confirm HTTPS. Set exact production/staging Supabase callbacks and Bunny allowed hosts.
4. Close outstanding 4A acceptance: actual SMTP invite/reset/resend, hosted access revocation, interrupted TUS upload/removal, real-device/long-session video, existing alternate media paths and recovery verification. Do not invite real students yet.
5. Smoke test with dedicated accounts: production URL opens; admin login; student login; assigned module opens; unassigned module denies; Bunny plays with protections; attachment downloads; invite/reset messages point to the intended host and complete successfully. Admin preview verifies delivery first; then enable the gate, deploy once and confirm student playback.
6. Record results and resolve failures before real enrollment. Later changes are tested on staging before an approved main release.

Preparation is complete; initial deployment is **not executable yet** without the remote URL, approved repository publication and manual Netlify/service setup. No external account, DNS, database, credential, Portal service or paused project was modified/reactivated.
