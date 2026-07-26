# Setup and environments

## Services

Project Interviewer uses:

- Convex for application data, generated-image storage, scheduled operations, Agent transcripts, rate limiting, and Better Auth integration;
- Google and GitHub OAuth for Creator authentication;
- OpenRouter for GPT-5.6 Terra, DeepSeek V4 Flash, and GPT Image 2;
- Cloudflare Email Service for Project Submission notifications; and
- Cloudflare static asset hosting for the React/Vite SPA.

Use separate Convex deployments, OAuth applications, provider budgets, and credentials for local development, shared development, and production.

## Local development

Install dependencies and select or create a Convex development deployment:

```sh
bun install
bunx convex dev --once
```

Convex writes the public deployment URLs to `.env.local`. If the initial push stops because server configuration is missing, configure the selected deployment and run the command again.

Set server-only values directly on the Convex deployment:

- the exact frontend site URL in `SITE_URL`; Convex supplies its server-side
  `CONVEX_SITE_URL` system variable automatically;
- a Better Auth secret;
- at least one complete Google or GitHub OAuth credential pair;
- `CAPABILITY_ENCRYPTION_SECRET`, as a separate high-entropy secret for recoverable Interview Links;
- `CREATOR_ALLOWLIST`, as a comma-separated list of verified Creator email addresses;
- the OpenRouter API key, with the desired account-level spend limit configured in OpenRouter; and
- the full Cloudflare Email Service sending endpoint, API token, and sender.

Only public Convex URLs belong in `VITE_` variables. OAuth secrets, auth secrets, OpenRouter keys, email credentials, Interview Links, and session tokens must never enter the frontend build.

Use `.env.convex.example` as the deployment checklist. Set a value with:

```sh
bunx convex env set CREATOR_ALLOWLIST creator@example.com
```

Repeat that command for each server variable. Keep independent values and
budgets for local development, shared development, and production.

Run Convex and Vite in separate terminals:

```sh
bun run convex:dev
```

```sh
bun run dev
```

Open `http://localhost:5173`. Application state lives in Convex; the browser does not provide a separate application runtime.

## OAuth

Configure the Better Auth callback for each enabled provider using the Convex HTTP Actions site:

```text
https://your-deployment.convex.site/api/auth/callback/google
https://your-deployment.convex.site/api/auth/callback/github
```

Allow the exact frontend site URL. Passwords, passkeys, implicit email linking, and explicit provider linking are not supported.

The first provider used for a verified email owns that Creator account. An attempt through the other provider must direct the Creator back to the owning provider without creating or linking an account.

## OpenRouter

Configure only these Interview Models:

- GPT-5.6 Terra with medium reasoning;
- DeepSeek V4 Flash with thinking at high effort; and
- DeepSeek V4 Flash without thinking for Creator-triggered Template Translation.

GPT Image 2 renders every Visual Concept at medium quality and 1536×1024.

Every request must require zero data retention, deny data collection, and disable model/provider fallback. A request fails when no compliant route is available. OpenRouter's account-level spend limit is authoritative; the application does not maintain a second spend counter. Per-Interview-Link rate limits remain active to prevent abuse.

These guarantees are request-owned application behavior, not optional
deployment preferences. The deterministic provider contract tests must verify
them without contacting OpenRouter.

## Cloudflare Email Service

Configure the Cloudflare Email Service REST API in Convex. The Project Submission operation commits independently of email delivery.

The notification contains only the project name, submitted status, and an authenticated Creator dashboard link. It must not contain the Project Document, transcript, Visual Concepts, Client messages, or Interview Link.

Set `CLOUDFLARE_EMAIL_API_URL` to the complete account sending endpoint:

```text
https://api.cloudflare.com/client/v4/accounts/ACCOUNT_ID/email/sending/send
```

`CLOUDFLARE_EMAIL_API_TOKEN` and `EMAIL_FROM` remain server-only. The
notification recipient is the owning Creator's verified email, not deployment
configuration.

## Build and deploy

Run the repository verification:

```sh
bun run verify
```

This gate is deterministic: it does not call paid providers or deploy hosted
state. The production build step verifies that emitted Cloudflare headers use
exact configured Convex origins, omit `unsafe-inline` and wildcard sources,
disable referrer leakage and indexing, and contain no inline script or style
blocks.

Build the static SPA:

```sh
bun run build:production
```

Deploy Convex and then the Cloudflare static application:

```sh
bun run deploy:convex
bun run deploy:cloudflare
```

Hosted-state changes require an explicit deployment decision; repository verification does not deploy.
