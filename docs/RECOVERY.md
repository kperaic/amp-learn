# AMP Learn — backup and recovery

Reviewed 2026-11-25. Target: AMP Learn Supabase project `ozcjishpcyhoghqgpgau`, Bunny library `820051`. Never use AMP Client Portal credentials or restore into its project. This is a runbook, not evidence that a backup or restore has been performed.

## What is currently available

The repository is on local `staging`, with no commits and no remote. Git therefore provides **no recoverable source checkpoint yet**. External machine backups were not inspected. The project documentation targets Supabase Free; the live billing plan and backup dashboard were not accessible during this audit.

Supabase documents daily database backups for paid plans (Pro: 7 days, Team: 14, Enterprise: up to 30). For Free, use manual exports stored off-site; do not rely on a dashboard restore point. Database backups contain Storage metadata, **not the uploaded file bytes**. Confirm the actual plan and available restore dates before relying on them. [Supabase backup documentation](https://supabase.com/docs/guides/platform/backups)

Bunny delivery replicas are not an independently verified recovery copy. No video backup or original-file retention setting was inspected. Keeping originals increases storage usage; retain your own source videos independently. [Bunny FAQ](https://bunny.net/faq/)

## Separate recovery sets

| Set | What to preserve | How to recover and verify |
| --- | --- | --- |
| Application source | Source, package/lock files, migrations, setup templates and docs; reviewed local Git checkpoint and an authorized private remote/off-device copy | Restore a reviewed revision, use Node 24 and `npm ci`, restore environment separately, then typecheck/test/build. Do not roll back to the vulnerable pre-4A dependency versions. |
| Database and Auth | Database schema/data/roles, Auth identities/password hashes as included in the chosen backup method, custom Storage RLS, and migration history | Restore into a **separate empty Learn test project first** using Supabase's supported procedure. Verify Auth UUIDs still match profiles, module grants and progress. Do not recreate users with new UUIDs. Require fresh login; old sessions/tokens are not a recovery goal. |
| Storage objects | Exact object bytes for both private buckets; bucket/path/size/MIME/checksum inventory; corresponding DB snapshot | Restore through the Storage API, not by inserting `storage.objects` rows. Preserve paths. Reconcile referenced ready attachments and covers against actual objects. Verify a signed download as an authorized test user and denial as another user. |
| Bunny videos | Original source files, library/video UUID-to-lesson mapping, captions/other assets actually used, security and encoding settings | Re-upload lost media through Bunny only after review. New uploads may get new UUIDs: update affected lesson associations explicitly and repeat signed/unsigned delivery tests. Never substitute public video links to recover availability. |
| Secrets | Learn environment values and separate Supabase/Resend/Bunny dashboard recovery credentials, in a password manager/encrypted offline copy | Restore only to the intended environment. New project keys require deliberate replacement. Rotate only after confirmed exposure or an authorized rotation, then verify callbacks/signing. Never put secrets or database dumps in Git. |
| External configuration | Supabase Auth providers/signups, exact redirect allowlist, email templates, SMTP sender/settings, bucket limits; Bunny token/referrer/direct-access settings; future Netlify settings | Recreate from a dated configuration record, without copying another product's configuration. Run the release checklist before enabling student video delivery. |

## Before any destructive migration or cleanup

1. Verify the exact Learn project and record the deployed revision, migration list, bucket settings and Bunny mapping. Stop content/access edits and wait for active uploads so exports represent a coherent state.
2. Make a fresh encrypted off-device database export using the current [Supabase CLI backup/restore procedure](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). Export roles, schema and data, and migration history where available. Check the actual dump includes required Auth data; a `public`-only dump cannot recover accounts. Preserve custom `storage.objects` policies from the applied migrations separately. Never paste a database connection password into chat or commit dump files.
3. Separately copy Storage object bytes with an authorized Storage API/S3 export and preserve an inventory/checksums. Separately back up original Bunny videos. A database export alone is insufficient.
4. Validate export files are nonempty/readable and perform a test restore to an isolated project. Confirm counts, UUID relationships, RLS/grants and a sample recovered attachment. Record date, location, person responsible and result. Keep at least the pre-change copy and the last known working copy off the workstation.
5. Only after a verified backup and explicit user approval perform a destructive change. Applying a remote migration still requires approval. A tested recovery plan is not authorization to run it.

The supported restore procedure also requires reconfiguring external Auth/SMTP settings and customizations to managed schemas; they are not automatically reconstructed by a generic schema export. Follow the provider guide for the installed CLI/database versions rather than replaying a dump blindly into the existing project. [Supabase restore procedure](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)

## Failure and orphan handling

- Provider outage: preserve data and retry; never relax RLS or make a bucket public. A Bunny outage leaves authorized text and materials usable; Storage failure should not be treated as permission to expose permanent URLs.
- Pending attachment: reselect the same local file to resume, or use Verify upload if bytes arrived but finalization failed. When that fails, use explicit Remove and start again. Never mark ready without matching stored size/MIME.
- Removal failure: the record stays pending and retryable. If bytes were removed but DB deletion failed, retry Remove to finish reconciliation. Investigate using object metadata, not confidential download URLs in logs.
- Replaced/failed covers are retained by the existing workflow. Periodically compare `modules.cover_path` and `lesson_attachments.storage_path` against a complete object inventory. Back up first; exclude in-flight uploads and require approval before deleting confirmed unused objects. No cleanup job was introduced.
- Backup failure or unknown restore state: postpone destructive work. A successful file export is not proof of a successful restore.

Before production, record actual backup ownership, locations and a successful restore exercise. No automatic backup service, paid upgrade, live export or destructive test was created in Phase 4A.
