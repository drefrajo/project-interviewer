# Deployment

## Environments

Interview has one local environment and two hosted environments:

| Environment | Frontend | Convex | Provider mode |
| --- | --- | --- | --- |
| Local | `http://localhost:5173` | Individual development deployment | Test credentials |
| Development | Shared development Worker | Dedicated development deployment | Stripe sandbox and development credentials |
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

Protect both `development` and `master`. Require a pull request and the `Verify`
status check for both branches. Branch protection can enforce the PR and CI
gates; the hosted development check remains a human release decision.

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

The Cloudflare token should be scoped to the account and Worker deployment
permissions only. `VITE_` values are public browser configuration; all other
application secrets remain on the matching Convex deployment.

The current Wrangler configuration names the Workers
`project-interviewer-development` and `project-interviewer`. The first deploy
creates them under their `workers.dev` URLs. After that first deploy, attach the
chosen custom domain to each Worker in Cloudflare. The domains remain attached
across later CI deployments.

## Convex configuration

The project already has a default production deployment and one or more
development deployments. Use the default production deployment for production.
For the shared development environment, use a dedicated persistent development
deployment rather than a developer's personal deployment. If the current
development deployment is already the shared one, do not create another.

From an authenticated machine, a new shared development deployment and scoped
CI keys can be created with:

```sh
bunx convex deployment create dev/shared --type dev
bunx convex deployment token create ci-development --deployment dev/shared
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
domains exist. OAuth callback URLs continue to use the matching Convex
`.convex.site` URL.

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
