# AMP Learn

- Verify the absolute working directory before file writes, Git or database operations. All work belongs to `/Users/kresimirperaic/Documents/amp-learn`.
- `/Users/kresimirperaic/Documents/amp-client-portal` is a read-only reference. Never modify it, its Git history/configuration, credentials, database, or deployment. Copy selected source only; never copy .git, .env, node_modules, artifacts, or business migrations.
- Never commit secrets. `.env.local` stays ignored. Privileged clients require server-only imports and explicit authorization.
- Keep roles limited to super_admin/student. Enforce active accounts, content publication and explicit module access in RLS and server actions. Preserve minimal grants. Do not trust user metadata for roles.
- Use fresh migrations; never edit an applied migration. Remote migrations require explicit approval. Test with isolated fixtures.
- Develop on staging; main is future production. Never push or merge main without explicit authorization. No pushes or deployments during Phase 1. Verify any future remote; never guess it.
- Phase 4B deployment preparation is authorized: minimal deployment review and documentation only. Preserve implemented workflows; do not repeat Phase 4A audits/tests. No external deployment, main push/merge or remote migration without explicit approval. Applied migrations are immutable. New attachments remain limited to 50 MB or the lower bucket limit.
- Reuse AMP Instrument Sans/burgundy styling and lightweight HR/EN dictionaries.
- Read relevant bundled Next.js documentation in node_modules/next/dist/docs before coding; this app uses Next 16 and proxy.ts.
- Run targeted tests while developing, then typecheck and a production build at a phase boundary. Live provider tests are separate from simulated tests.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
