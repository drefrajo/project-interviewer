# Launch readiness

## Machine gate

Run:

```sh
bun run verify
```

The deterministic repository gate contains only tests that protect a user-visible flow, an authorization/privacy boundary, or irreversible data behavior:

- focused Convex checks for Creator ownership, regenerated Interview Links, first-write-wins submission, and cascading deletion;
- one provider-request contract check for pinned model settings, OpenRouter privacy requirements, and the minimal Cloudflare Email payload;
- the production build with a strict Content Security Policy that never uses `unsafe-inline`; and
- TypeScript and ESLint checks.

Do not add lower-level tests that duplicate these behaviors.

The configured application gate additionally runs one browser flow against the
real React application and a dedicated Convex development deployment. Replace
AI, image, and email calls only at their narrow Convex boundaries. Verify
Creator Interview creation, the complete Client Interview and Document Review,
the first concept batch and, if exercised, the second batch, Visual Direction
selection, immutable submission, Creator visibility, and ZIP download. Include
one accessibility pass at desktop and mobile widths and inspect the served
Content Security Policy. This gate must not use a production deployment.

## Provider and language evaluation

Before launch, run one representative website Interview in each supported pairing:

- English with GPT-5.6 Terra;
- German with GPT-5.6 Terra.

Review whether each Interview reaches a useful Project Document efficiently, preserves supplied facts, marks unknown facts, writes credible first-draft copy, and generates three meaningfully different Visual Concepts. This is an opt-in launch evaluation rather than a broad deterministic test matrix.

## Security and privacy gate

Confirm in the configured production environment that:

- Creator registration is allowlisted;
- Google and GitHub sign-in work independently and matching emails cannot link or duplicate accounts;
- Interview Links are unguessable, regeneration invalidates the prior link, and Client pages are not indexed;
- every OpenRouter request denies data collection, disables ZDR routing, and disables fallback;
- no raw prompt, provider response, sensitive content, or Interview Link appears in diagnostic logs;
- the OpenRouter account-level spend limit and application per-Interview-Link rate limits are active;
- Markdown disables raw HTML and accepts only safe HTTP(S) links;
- the Content Security Policy has exact origins where possible and contains no `unsafe-inline`; and
- confirmed Interview deletion removes the transcript, Project Document, Visual Concepts, Project Submission, and link capability.

## Operational gate

Confirm that:

- temporary AI and image failures retry twice and then expose a retry action;
- successful Visual Concepts survive retry of a failed concept;
- email delivery failure never blocks Project Submission;
- an ambiguous email timeout is reported as delivery unknown rather than retried blindly;
- the Creator can download a complete ZIP and each individual artifact; and
- the submitted Client page is read-only and shows the Creator's business/display name and verified email.

## Monetization and Stripe gate

Complete this section in sandbox before any live-mode action:

- confirm the connected Stripe account is the intended sandbox account and
  that the secret begins with `sk_test_`; a live connection is a hard stop;
- confirm Managed Payments is enabled and the owner has accepted any required
  terms;
- confirm exactly two active one-time EUR Prices: €29 for 1 Interview Pass and
  €99 for 5 Interview Passes, with no subscription, metered, 20-pass, or
  per-model catalog;
- obtain owner/Stripe confirmation that `txcd_10105002` is the correct
  business-use cloud AIaaS classification before live setup;
- set the sandbox-only secret, webhook signing secret, two stable sandbox
  lookup keys, and success/cancellation URLs in the Convex environment, then run
  `bun run validate:convex-deploy`;
- register the public Convex `/stripe/webhook` endpoint for the documented
  Price, Checkout, delayed-payment, refund, and dispute events;
- complete a sandbox purchase for each pack, including a delayed-payment
  result where available, and verify webhook-only fulfillment, exactly-once
  retries, unpaid completion, cancellation, refund, partial-refund flagging,
  dispute debit/restoration, and a negative-balance case;
- verify the Creator receives exactly one Introductory Pass, that first link
  sharing reserves one pass atomically, deliberate Client Start consumes it
  exactly once, link rotation is free, and deletion/deactivation before versus
  after Start has the documented release behavior;
- reconcile the cached balance against the append-only Pass Ledger and record
  the operator/support contact for refunds, disputes, payment questions,
  product access, and privacy/deletion requests. Stripe handles its Managed
  Payments transaction support; the product operator still owns product
  fulfillment, account access, product quality, application data, and
  operator adjustments.

Live cutover is a separately approved action. The owner must create or reuse
the two eligible live catalog objects only after confirming Managed Payments
eligibility and the tax classification, set live values in a separate Convex
deployment secret store, verify the Stripe account reports live mode, register
the live webhook, and review the first real fulfillment/reconciliation event.
Do not substitute a live account for missing sandbox access, do not create live
objects during development, and do not make a live test purchase.

## Human approval

The product is ready to open beyond the allowlist only after a representative Creator and Client complete the full flow on mobile and desktop, understand that Visual Concepts are rough directions rather than final designs, and judge the Project Submission sufficient to begin implementation.
