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

- the Convex site URL and exact frontend site URL;
- a Better Auth secret;
- at least one complete Google or GitHub OAuth credential pair;
- the Creator registration allowlist;
- the OpenRouter API key, privacy-constrained routing configuration, and spend ceiling; and
- Cloudflare Email Service credentials, sender, recipient behavior, and the authenticated dashboard URL used in notifications.

Only public Convex URLs belong in `VITE_` variables. OAuth secrets, auth secrets, OpenRouter keys, email credentials, Interview Links, and session tokens must never enter the frontend build.

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

Every request must require zero data retention, deny data collection, and disable model/provider fallback. A request fails when no compliant route is available. Configure the application-owned global spend ceiling before allowing Creators to start Interviews.

## Cloudflare Email Service

Configure the Cloudflare Email Service REST API in Convex. The Project Submission operation commits independently of email delivery.

The notification contains only the project name, submitted status, and an authenticated Creator dashboard link. It must not contain the Project Document, transcript, Visual Concepts, Client messages, or Interview Link.

## Build and deploy

Run the repository verification:

```sh
bun run verify
```

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
