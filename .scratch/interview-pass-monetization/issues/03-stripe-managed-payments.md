# Stripe Managed Payments checkout and webhook fulfillment

Status: ready-for-agent
Type: task

Implement authenticated server-side hosted Checkout creation for the two
allowlisted one-time EUR packs, sandbox/live fail-closed configuration, raw
body webhook signature verification, and exactly-once purchase/refund/dispute
effects. Browser redirects must never fulfill purchases.

## Comments

- 2026-08-02: Implemented behind a Stripe provider seam with REST adapter and
  deterministic fakes; no live Stripe mutation is part of this task.
- 2026-08-02: Sandbox catalog was verified read-only after setup; Checkout and
  webhook provider-boundary tests pass without contacting Stripe.
- 2026-08-02: Corrected the sandbox Convex deployment configuration after the
  first Checkout attempt used Product IDs instead of the approved Price IDs;
  the local success and cancellation URLs are also configured for development.
- 2026-08-02: Fixed catalog validation to accept Stripe's `recurring: null`
  representation for one-time Prices; the real sandbox response had exposed
  this mismatch behind the generic Checkout error.
- 2026-08-02: Fixed sandbox mode verification for Basil account responses that
  omit `livemode`; sandbox `sk_test_` plus the independently verified Price and
  Product mode checks remain required before any Stripe mutation, while live
  mode still fails closed.
- 2026-08-03: Replaced fixed Price-ID configuration with stable Stripe lookup
  keys. The current active Price is resolved at checkout, cached for the UI,
  refreshed by Price webhooks, and repaired by an hourly read-only Convex sync.
