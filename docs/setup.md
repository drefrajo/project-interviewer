# Setup, environments, and hosted launch

## Run the complete application locally

Every browser mode uses the same Convex-backed runtime. Local development is
Vite on `http://localhost:5173` connected to a Convex development deployment;
it exercises Better Auth, Invite Links, Convex File Storage, durable workflows,
authorization, and configured OpenRouter models through the same interfaces as
development and production.

1. Install dependencies and select/create the Convex development deployment:

```sh
bun install
bunx convex dev --once
```

   On the first run, Convex writes the selected deployment URLs to
   `.env.local`. The push can stop on a missing server environment variable;
   that is expected until the next step is complete.

2. Configure that deployment from `.env.convex.example`. For local use, set
   `SITE_URL=http://localhost:5173`, use the `CONVEX_SITE_URL` printed by
   Convex, and provide at least one development OAuth provider plus OpenRouter
   credentials.

3. Start the Convex watcher, then run Vite in another terminal:

```sh
bun run convex:dev
```

```sh
bun run dev
```

Open `http://localhost:5173`. Project state and uploaded material live in the
selected Convex deployment, not in browser application storage. Local browser
storage is used only for device/session capabilities needed by Invite Links.

Run all machine checks with:

```sh
bun run verify
```

This writes the deterministic machine-readable launch report to
`.scratch/file-first-discovery/evaluation-report.json`. Domain and adapter fakes
remain test-only fixtures; they are not a second browser runtime.

Run the configured deployment/browser gate separately against a running app.
First capture an authenticated Freelancer session, then execute the gate:

```sh
RUNTIME_BASE_URL=http://localhost:5173 bun run runtime:capture-session
RUNTIME_BASE_URL=http://localhost:5173 bun run verify:runtime
```

The session is saved by default under the ignored `.scratch/runtime/`
directory. Set `RUNTIME_FREELANCER_STORAGE_STATE` to use another path. The
gate drives the selected Convex deployment and therefore requires the local
environment above, valid authentication, working file storage and workflows,
configured AI models, and OpenRouter quota. It creates a clearly named runtime
verification Project Room. On systems where the browser is not in a standard
location, set `BROWSER_EXECUTABLE_PATH` to Chrome, Edge, or Chromium. See
[launch-readiness.md](launch-readiness.md) for the machine, runtime, and human
gates.

Convex function and boundary contract tests still run deterministically without
live credentials. `bun run build` produces the single Convex client SPA in
`dist/`.

## Configure Convex environments

Create or select the deployment appropriate to the Vite mode:

   ```sh
   bunx convex dev
   ```

   This selects a development deployment, writes local Convex configuration,
   generates `convex/_generated`, and continuously pushes schema/functions.
   Use separate deployments, secrets, OAuth applications, and OpenRouter
   budgets for shared development and production.

2. Start from `.env.local.example`, `.env.development.example`, or
   `.env.production.example`. Public browser values are limited to
   `VITE_CONVEX_URL` and `VITE_CONVEX_SITE_URL`. Never put OAuth secrets,
   deploy keys, auth secrets,
   OpenRouter keys, Invite Links, or session tokens in a `VITE_` variable.

3. Use `.env.convex.example` as the checklist for server-only values and set
   them directly on each Convex deployment:

   ```sh
   bunx convex env set CONVEX_SITE_URL https://your-deployment.convex.site
   bunx convex env set SITE_URL https://discovery.example.com
   bunx convex env set BETTER_AUTH_SECRET your-random-secret
   bunx convex env set GITHUB_CLIENT_ID your-github-client-id
   bunx convex env set GITHUB_CLIENT_SECRET your-github-client-secret
   bunx convex env set OPENROUTER_API_KEY your-openrouter-key
   ```

   Use the exact `CONVEX_SITE_URL` printed for the deployment. These server
   values do not need to be duplicated on the Cloudflare build or deploy
   machine. Google and GitHub are independently optional, but each enabled
   provider requires both its client ID and client secret, and at least one
   provider must be configured so the first Freelancer can sign in.

## Configure Google, GitHub, and passkeys

Create an OAuth application for each provider you want to enable. Add the
corresponding callback URL using the Convex HTTP Actions site URL:

```text
https://your-deployment.convex.site/api/auth/callback/google
https://your-deployment.convex.site/api/auth/callback/github
```

The example above bootstraps with GitHub. Google can be enabled later without a
code change:

```sh
bunx convex env set GOOGLE_CLIENT_ID your-google-client-id
bunx convex env set GOOGLE_CLIENT_SECRET your-google-client-secret
```

After both variables are set, the next Convex function reload exposes Google
sign-in and account linking automatically. A half-configured credential pair is
rejected rather than exposing a broken sign-in button.

Also allow the exact frontend `SITE_URL`. The application disables passwords
and implicit email linking. A signed-in user links another provider explicitly.
Passkeys are registered only from an authenticated session and can then be used
as standalone sign-in methods. The server prevents removal of the last method;
removing the final OAuth provider additionally requires two registered
passkeys.

Production passkeys require HTTPS and an RP ID matching the frontend hostname.
Browsers accept `localhost` for local passkey testing; the local runtime still
requires a real Freelancer authentication method.

## Configure OpenRouter

Create an OpenRouter API key and configure it in the Convex environment
described by `.env.convex.example`. Model selection for all six roles is
source-owned in `src/infrastructure/ai-model-configuration.ts`, so every
environment runs the same reviewed model policy. The embedding model and vector
dimensions are defined together because changing either requires re-embedding
stored material and migrating the Convex vector index.
Every request requires zero-data-retention and denies data collection while
allowing OpenRouter to select an eligible provider.

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
