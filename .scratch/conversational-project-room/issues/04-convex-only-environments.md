# 04 — Convex-only Environments

Status: resolved
Starting commit: `cda1d94e6e87f20bce7951c9fd2ee1386304b82f`

## What to build

Remove the browser local-storage application mode. Local, development, and
production frontend builds all bootstrap the hosted Convex runtime and require
the same public configuration.

## Acceptance criteria

- [x] `main.tsx` has no local/runtime branch and always creates the hosted
      runtime.
- [x] Environment parsing validates `local`, `development`, and `production`
      labels plus all public Convex/site URLs without exposing secrets.
- [x] Browser domain persistence and the `dev:local` script are removed; pure
      deterministic adapters may remain only where tests/evaluation need them.
- [x] Example environments and setup docs describe running Convex plus Vite and
      the full authentication/storage/workflow/AI seams locally.
- [x] Environment/bootstrap/runtime tests cover all three labels and missing
      configuration.

## Follow-up integration

- Migrated the remaining production presentation markup to Tailwind utilities
  and deleted the obsolete component stylesheet. The authored stylesheet now
  contains only theme/base tokens, the skip link, print rules, and the
  reduced-motion fallback.
- Project Material now imports content-type detection from the application
  module rather than the local adapter boundary.

## Verification

- `bun run typecheck`
- `bun run lint`
- `bun run build`
- `git diff --check`
