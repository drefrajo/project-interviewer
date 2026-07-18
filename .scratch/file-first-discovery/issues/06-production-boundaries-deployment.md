# 06 — Production boundaries and deployment

**What to build:** The locally complete application can be connected to Convex, Better Auth, OpenRouter, and Cloudflare through documented environment configuration without changing domain behavior or weakening authorization and privacy.

**Blocked by:** 05 — Durable Project Home lifecycle.

**Status:** resolved

**Starting commit:** `e1493243c5d130b0b3473183a916dbb5fde4b495`

## Authorized public test seams

- Convex query/mutation/action/workflow endpoints exercised with generated API types or contract fakes.
- Better Auth account-method policy and OpenAI-compatible adapter contract.
- Environment validation and Cloudflare production build/deployment configuration.

## Acceptance criteria

- [x] Convex schema/functions/workflows implement room-scoped authorization, storage, full-text/vector indexes, scheduled purge, bounded retries, cancellation, quotas, and idempotency.
- [x] Better Auth on Convex supports Google/GitHub registration, explicit provider linking, standalone passkeys, two-passkey final-OAuth unlink rule, and last-method protection.
- [x] OpenAI-compatible adapter supports role-specific chat/tools/structured output/embeddings/multimodal, validation plus one repair, ZDR/data-collection denial, allowed routing, and actual provider/model usage capture.
- [x] No content, raw prompts/files/excerpts/transcripts/tokens, storage URLs, or Invite Links enter logs or analytics.
- [x] Cloudflare Workers static SPA configuration provides history fallback and uses no Cloudflare-only application APIs.
- [x] Environment validation cleanly distinguishes credential-free local mode from production requirements.
- [x] Local and hosted setup/run/deploy instructions cover Convex, OAuth/passkeys, OpenRouter, and Cloudflare.
- [x] Contract tests, typecheck, lint, and production build verify every configured boundary without requiring live credentials.

## Verification

- `bun run test` — 148 tests passed.
- `bun run typecheck` — passed.
- `bun run lint` — passed.
- `bun run build` — passed.
- Credential-shaped production build and deploy-environment validation — passed with local placeholders.
- Standards review against the starting commit — clean.
- Spec review against the starting commit — clean.
