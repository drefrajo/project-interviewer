# Deployment

## Environments

Interview has one local environment and two hosted environments:

| Environment | Frontend | Convex | Provider mode |
| --- | --- | --- | --- |
| Local | `http://localhost:5173` | Individual development deployment | Test credentials |
| Development | Shared development Worker | `development` (`scrupulous-spoonbill-921`) | Stripe sandbox and development credentials |
| Production | Production Worker | Dedicated production deployment | Live credentials after approval |

Do not share Convex deployments, storage, OAuth applications, provider keys,
Stripe modes, or email credentials between development and production.

## Branches

The deployment workflow in `.github/workflows/ci-cd.yml` uses this flow:

```text
feature branch -> development -> master
                  development    production
```

Pull requests run `bun run verify` without deploying. A push to `development`
deploys the development Convex deployment first and then the development
Cloudflare Worker. A push to `master` performs the same sequence for production.
The intended promotion flow is:

1. Create a feature branch from `development`.
2. Run `bun run convex:dev` and test against the local Convex deployment.
3. Open a pull request into `development` and merge it after CI passes.
4. Test the hosted development Worker and shared Convex deployment.
5. Open a pull request from `development` into `master` and merge it after the
   hosted development check passes.

Protect both `development` and `master`, but use different rules. Allow direct
pushes to `development` while preventing force pushes and deletion. Require a
pull request and the `Verify` status check for `master`. Branch protection can
enforce the production PR and CI gates; the hosted development check remains a
human release decision.

The production deployment is intentionally a normal merge to `master`, not a
separate release system. Configure a required GitHub production reviewer only
if merging to `master` should not be the sole approval.

## GitHub configuration

Create `development` and `production` GitHub environments. Add these variables
to each environment:

- `VITE_CONVEX_URL`
- `VITE_CONVEX_SITE_URL`
- `CLOUDFLARE_ACCOUNT_ID`

Add these secrets to each environment:

- `CONVEX_DEPLOY_KEY`
- `CLOUDFLARE_API_TOKEN`

For the `development` environment, `VITE_CONVEX_URL` must be
`https://scrupulous-spoonbill-921.convex.cloud` and `VITE_CONVEX_SITE_URL` must
be `https://scrupulous-spoonbill-921.convex.site`. Its `CONVEX_DEPLOY_KEY` must
be a new deployment-scoped key for `development`. The production environment
continues to use its existing values and key for the default production
deployment.

The Cloudflare token should be scoped to the account and Worker deployment
permissions only. `VITE_` values are public browser configuration; all other
application secrets remain on the matching Convex deployment.

The current Wrangler configuration names the Workers
`project-interviewer-development` and `project-interviewer`. The first deploy
creates them under their `workers.dev` URLs. After that first deploy, attach the
chosen custom domain to each Worker in Cloudflare. The domains remain attached
across later CI deployments.

## Convex configuration

The project uses the default production deployment for production. The shared
development environment uses the persistent `development` deployment
(`scrupulous-spoonbill-921`); do not create another development deployment for
CI or hosted development.

From an authenticated machine, select the shared development deployment and
create scoped CI keys with:

```sh
bunx convex deployment select drefrajo:project-interviewer:development
bunx convex deployment token create ci-development --deployment development
bunx convex deployment token create ci-production --deployment prod
```

The token commands print secrets. Store the development token in the GitHub
`development` environment and the production token in the GitHub `production`
environment. Generate tokens with only the `deployment:deploy` permission when
the dashboard offers permission selection.

Set `SITE_URL`, auth secrets,
OAuth credentials, provider keys, email credentials, allowlists, and Stripe
configuration directly on the matching deployment. Use sandbox Stripe
configuration in development and live Stripe configuration only in production
after the launch checks are approved.

Set the final Cloudflare custom domain in `SITE_URL`, Stripe success/cancel
URLs, and the appropriate OAuth allowed-origin settings after the Worker
domains exist. Hosted development keeps using the matching Convex `.convex.site`
OAuth callback. Production uses the custom callback proxy only when the
production Convex deployment has these variables set:

```text
GOOGLE_REDIRECT_URI=https://interview.drefrajo.dev/api/auth/callback/google
GITHUB_REDIRECT_URI=https://interview.drefrajo.dev/api/auth/callback/github
```

Add the exact URLs to the corresponding production OAuth clients. The
production Wrangler deploy passes the production `VITE_CONVEX_SITE_URL` to the
Worker as its proxy origin, while the development deploy does not configure
that variable.

`bun run validate:convex-deploy` is a secure provisioning preflight. It checks
the complete Stripe configuration supplied to the local command. It is not part
of CI because the runtime values are stored on Convex. Manual
`bun run deploy:convex` keeps that fail-closed validation. CI uses
`bun run deploy:convex:ci`, which only requires `CONVEX_DEPLOY_KEY` and deploys
to the deployment associated with that key.

Generated Convex bindings under `convex/_generated/` are committed so a clean
pull-request checkout can typecheck without exposing a Convex deploy key. Run
`bun run convex:codegen` after changing Convex functions or schemas and include
the generated binding changes in the same commit.

## Release order

Deploy Convex before the frontend. New backend functions and fields must remain
compatible with the previous frontend for the duration of the release. The
frontend is built separately for each environment because the Convex URLs are
embedded in the Vite output. Hosted development intentionally uses the
production Vite build mode so its emitted CSP contains exact development
origins; its deployment target still comes from the development environment
variables and Wrangler environment.

## Analytics

The hosted frontends use a self-hosted Umami instance at `data.drefrajo.dev` for
privacy-friendly analytics. `src/infrastructure/analytics.ts` injects the
tracker script only in the hosted environments; local development never loads
it. The same Umami website (`4eae153d-6e6b-4d01-bbc6-482422a8fa89`) receives
traffic from both hosted environments, and Umami records the `hostname` with
every event, so development and production traffic is separated by subdomain
(use the domain filter in the dashboard to split them).

The tracker is installed with `data-exclude-search="true"` (query strings are
never stored, including OAuth codes and one-time tokens) and
`data-do-not-track="true"` (visitors with Do Not Track enabled are not
tracked). Umami sets no cookies. The integration sends no personal data:
pageviews carry only path, hostname, title, language, referrer, and screen
size, and custom events are fixed interaction names without user input. All
event names live in `src/infrastructure/analytics.ts`.

The CSP in `public/_headers` allows the analytics origin:

- `script-src`: `https://data.drefrajo.dev` for the tracker script
- `connect-src`: `https://data.drefrajo.dev` for the tracking requests

IP handling (masking) is configured on the Umami server, not in this
repository.

## Data migrations

Convex function and schema deployment is automatic. Application data migration
is not an implicit part of a production deploy.

When a data migration is needed:

1. Add the new optional schema and code paths while preserving the old shape.
2. Deploy the backward-compatible code to development.
3. Run an idempotent, chunked migration job explicitly and verify its result.
4. Run the same migration against production as a separately approved action.
5. Remove the old shape in a later release after all environments are complete.

Do not combine destructive changes, large backfills, or pass-ledger and
purchase transformations with the normal deploy command. A failed migration
must be safe to retry, and reverting Git code must not be treated as a data
rollback. Export or otherwise back up production data before a migration that
changes durable records or stored files.

## Manual deployment

For an emergency or initial setup, use the same order as CI:

```sh
bun run deploy:convex
bun run deploy:cloudflare
```

The development frontend uses its Wrangler environment explicitly:

```sh
bun run deploy:convex
bun run deploy:cloudflare:development
```
