# Setup and environments

## Services

Project Interviewer uses:

- Convex for application data, generated-image storage, scheduled operations, Agent transcripts, rate limiting, and Better Auth integration;
- Google and GitHub OAuth for Creator authentication;
- OpenRouter for GPT-5.6 Terra and GPT Image 2;
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

## Stripe Managed Payments and Interview Passes

Interview Passes are prepaid, non-expiring entitlements. Creating and editing
an Interview is free; the first Creator copy/share action reserves exactly one
pass and makes its Interview Link usable. The Client's deliberate Start
converts that reservation into a consumed pass before billable AI work. The
sandbox catalog contains only these tax-exclusive
business prices:

| Pack | Price | Passes | Mode |
| --- | ---: | ---: | --- |
| 1 Interview Pass | €29 | 1 | one-time |
| 5 Interview Passes | €99 | 5 | one-time |

The UI says “plus applicable taxes.” The application uses Stripe Managed
Payments Checkout with `mode=payment`, `managed_payments.enabled=true`, and
API version `2025-03-31.basil`. The configured product tax code is provisionally
`txcd_10105002` (business-use cloud AIaaS); the owner must obtain final Stripe
and tax confirmation before any live setup.

Configure the following server-only variables on the matching Convex
deployment. Keep sandbox and live values in separate deployment secret stores;
never put these values in `VITE_` variables or source control:

- `STRIPE_MODE`: `sandbox` for `sk_test_...`, or `live` for `sk_live_...`;
- `STRIPE_SECRET_KEY`: preferably a restricted key;
- `STRIPE_WEBHOOK_SIGNING_SECRET`;
- `STRIPE_ONE_PASS_PRICE_ID` and `STRIPE_FIVE_PASS_PRICE_ID`;
- `STRIPE_CHECKOUT_SUCCESS_URL` and `STRIPE_CHECKOUT_CANCEL_URL`.

For sandbox setup, the owner must:

1. Connect the Stripe sandbox account and confirm that the Dashboard and key
   are in sandbox mode. If the connected account is live, stop; do not create
   or change any Stripe object.
2. Enable Managed Payments and accept its owner-controlled terms if Stripe
   requires the Creator to reserve a pass before sharing. Confirm that this product and the business-use AIaaS
   tax code are eligible.
3. Create or reuse exactly the two sandbox Products/Prices above. Keep their
   approved Price IDs only in the Convex environment configuration.
4. Register `POST https://<deployment>.convex.site/stripe/webhook` with these
   events: `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`, `charge.refunded`,
   `refund.created`, `charge.dispute.created`, `charge.dispute.closed`,
   `charge.dispute.funds_reinstated`, and
   `charge.dispute.funds_withdrawn`. Store the signing secret in
   `STRIPE_WEBHOOK_SIGNING_SECRET`.
5. Set the environment values with `bunx convex env set` and run
   `bun run validate:convex-deploy`. The validator fails closed on incomplete
   configuration or sandbox/live key mismatch.
6. Complete a sandbox Checkout using a Stripe test payment method. Confirm
   that only the signed webhook changes the Pass Balance, delayed payments are
   handled, the success page only reports server state, and duplicate events
   do not add passes.

Existing Creator profiles receive one Introductory Pass through an idempotent
ledger grant. Existing started or submitted Interviews are treated as consumed
without a retroactive debit; existing unstarted Interviews require a
reservation before their links can be copied or shared.

Refunds and dispute losses append compensating ledger debits. If consumed
passes are revoked, the balance may become negative and future reservations are
blocked until reconciliation or an explicit operator adjustment; Interview
history is never rewritten. Partial refunds are flagged for reconciliation
and never guessed into a pass count. A reserved pass is released only by
deactivation or deletion before Start; Start permanently consumes it. Use the
internal reconciliation capability
(`billing:reconcileCreator`) and append-only ledger when investigating a case;
there is intentionally no administration UI in this release.

Do not perform live catalog creation, live webhook registration, or a live test
purchase as part of development. Live-mode Stripe mutations require separate
owner approval after the sandbox flow, Managed Payments eligibility, and tax
classification have been confirmed.

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

Configure GPT-5.6 Terra as the sole Interview Model. Interactive Interview
turns use low reasoning effort; planning, documents, revisions, concept
planning, and Template Translation use medium effort.

All Interviews use GPT Image 2 at medium quality for Visual Concepts. It renders
the three Visual Concepts at the configured 3:2 aspect ratio.

Every request denies data collection, disables zero-data-retention routing, and disables model/provider fallback. The OpenRouter account and guardrails must not enforce ZDR, since request-level `zdr: false` cannot override those higher-level restrictions. A request fails when no route matching the remaining policy is available. OpenRouter's account-level spend limit is authoritative; the application does not maintain a second spend counter. Per-Interview-Link rate limits remain active to prevent abuse.

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
