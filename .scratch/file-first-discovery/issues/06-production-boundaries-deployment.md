# 06 — Production boundaries and deployment

**What to build:** The locally complete application can be connected to Convex, Better Auth, OpenRouter, and Cloudflare through documented environment configuration without changing domain behavior or weakening authorization and privacy.

**Blocked by:** 05 — Durable Project Home lifecycle.

**Status:** ready-for-agent

## Authorized public test seams

- Convex query/mutation/action/workflow endpoints exercised with generated API types or contract fakes.
- Better Auth account-method policy and OpenAI-compatible adapter contract.
- Environment validation and Cloudflare production build/deployment configuration.

## Acceptance criteria

- [ ] Convex schema/functions/workflows implement room-scoped authorization, storage, full-text/vector indexes, scheduled purge, bounded retries, cancellation, quotas, and idempotency.
- [ ] Better Auth on Convex supports Google/GitHub registration, explicit provider linking, standalone passkeys, two-passkey final-OAuth unlink rule, and last-method protection.
- [ ] OpenAI-compatible adapter supports role-specific chat/tools/structured output/embeddings/multimodal, validation plus one repair, ZDR/data-collection denial, allowed routing, and actual provider/model usage capture.
- [ ] No content, raw prompts/files/excerpts/transcripts/tokens, storage URLs, or Invite Links enter logs or analytics.
- [ ] Cloudflare Workers static SPA configuration provides history fallback and uses no Cloudflare-only application APIs.
- [ ] Environment validation cleanly distinguishes credential-free local mode from production requirements.
- [ ] Local and hosted setup/run/deploy instructions cover Convex, OAuth/passkeys, OpenRouter, and Cloudflare.
- [ ] Contract tests, typecheck, lint, and production build verify every configured boundary without requiring live credentials.

