# Setup, local development, and hosted launch

## Run everything locally

The default mode is a complete credential-free development application. It
uses local deterministic AI adapters, `localStorage` for durable domain state,
and IndexedDB for uploaded file bytes. Convex, OAuth, OpenRouter, and
Cloudflare are not required.

```sh
bun install
bun run dev
```

Open `http://localhost:5173`. A second tab shares the same project state.
Clearing browser site data resets the local environment.

Run all machine checks with:

```sh
bun run verify
```

The production-shaped Convex functions and boundary contract tests also run
without credentials. `bun run build` produces the static SPA in `dist/`.

## Configure a hosted Convex backend

1. Create or select a Convex project. From the repository, run:

   ```sh
   bunx convex dev
   ```

   This selects the development deployment, writes local Convex configuration,
   generates `convex/_generated`, and continuously pushes schema/functions.
   Keep it running in one terminal; run `bun run dev` in another.

2. Copy `.env.production.example` to an untracked frontend build environment
   or provide the values through the deployment system. Public browser values are limited
   to `VITE_APP_MODE`, `VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL`, and
   `VITE_SITE_URL`. Never put OAuth secrets, deploy keys, auth secrets,
   OpenRouter keys, Invite Links, or session tokens in a `VITE_` variable.

3. Use `.env.convex.example` as the checklist for server-only values and set
   them directly on each Convex deployment:

   ```sh
   bunx convex env set SITE_URL https://discovery.example.com
   bunx convex env set BETTER_AUTH_SECRET your-random-secret
   bunx convex env set GOOGLE_CLIENT_ID your-google-client-id
   bunx convex env set GOOGLE_CLIENT_SECRET your-google-client-secret
   bunx convex env set GITHUB_CLIENT_ID your-github-client-id
   bunx convex env set GITHUB_CLIENT_SECRET your-github-client-secret
   bunx convex env set OPENROUTER_API_KEY your-openrouter-key
   bunx convex env set OPENROUTER_ALLOWED_PROVIDERS openai,anthropic
   bunx convex env set AI_MODEL_FILE_ANALYZER openai/gpt-5-mini
   bunx convex env set AI_MODEL_INTERVIEW_PLANNER openai/gpt-5
   bunx convex env set AI_MODEL_INTERVIEW_AGENT openai/gpt-5
   bunx convex env set AI_MODEL_INTERVIEW_REVIEWER anthropic/claude-sonnet-4
   bunx convex env set AI_MODEL_BRIEF_GENERATOR openai/gpt-5
   bunx convex env set AI_MODEL_EMBEDDINGS openai/text-embedding-3-small
   ```

   Convex supplies `CONVEX_SITE_URL`. Use the exact site URL printed for the
   deployment. These server secrets do not need to be duplicated on the
   Cloudflare build or deploy machine.

## Configure Google, GitHub, and passkeys

Create OAuth applications in Google Cloud and GitHub. Add these callback URLs,
using the Convex HTTP Actions site URL:

```text
https://your-deployment.convex.site/api/auth/callback/google
https://your-deployment.convex.site/api/auth/callback/github
```

Also allow the exact frontend `SITE_URL`. The application disables passwords
and implicit email linking. A signed-in user links another provider explicitly.
Passkeys are registered only from an authenticated session and can then be used
as standalone sign-in methods. The server prevents removal of the last method;
removing the final OAuth provider additionally requires two registered
passkeys.

Production passkeys require HTTPS and an RP ID matching the frontend hostname.
`localhost` is accepted by browsers for local passkey testing, but the
credential-free local app does not require sign-in.

## Configure OpenRouter

Create an OpenRouter API key and choose models for all six roles in
`.env.production.example`. `OPENROUTER_ALLOWED_PROVIDERS` is a comma-separated
allowlist. Every request sends provider routing with zero-data-retention
required, data collection denied, and fallbacks restricted to that allowlist.

Before a pilot, confirm the selected providers actually honor ZDR for the
chosen models in the OpenRouter dashboard. The adapter records only scrubbed
operational metadata: actual model/provider, input/output token counts,
estimated cost, latency, attempt count, status, and error code. It does not log
prompts, files, excerpts, transcripts, Invite Links, session tokens, or storage
URLs.

## Build and publish the static Cloudflare SPA

`wrangler.json` deploys only `dist/` and uses SPA history fallback. The
application does not call Cloudflare-specific APIs.

1. Authenticate and validate configuration:

   ```sh
   bunx wrangler login
   bun run validate:production
   ```

2. Provide `CONVEX_DEPLOY_KEY` from `.env.deploy.example` only to the Convex
   deploy job. Deploy Convex, then the static frontend:

   ```sh
   bun run deploy:convex
   bun run deploy:cloudflare
   ```

These commands change hosted state. They are instructions only; no production
deployment is performed by the repository checks.

## Human and credential-dependent launch checklist

- Create the Convex, Google, GitHub, OpenRouter, and Cloudflare projects.
- Set production secrets in Convex/CI and public URLs in the frontend build.
- Verify OAuth callbacks and two independent passkeys on the production domain.
- Confirm OpenRouter ZDR/provider routing with the chosen paid model accounts.
- Run the five human pilot projects and review generated briefs.
- Approve the production deployment and monitoring/privacy settings.
