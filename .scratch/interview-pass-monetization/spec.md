# Interview-pass monetization

Status: ready-for-agent

## Problem Statement

Creating and editing an Interview is free, but making an Interview Link usable
starts a complete paid product workflow. The Creator needs a simple, auditable
prepaid entitlement with no per-message or model-metering surprises.

## Solution

- Every Creator receives exactly one non-expiring Introductory Pass.
- A Creator may buy one-time EUR packs through Stripe Managed Payments: one
  Interview Pass for €29 or five Interview Passes for €99, plus applicable
  taxes.
- Creating and editing an Interview is free. The first time a Creator copies or
  shares its Interview Link, the server atomically reserves exactly one
  available pass and returns the link. The first action is labelled “Reserve 1
  pass and copy link.”
- Subsequent copies and link rotations transfer the same reservation without
  another debit. A Client welcome page, preview, crawler, or bot request never
  consumes a pass.
- When the Client deliberately clicks Start interview, the server atomically
  converts the reservation to a consumed pass before billable AI work. Duplicate
  and concurrent starts have exactly-once effects.
- Deleting or explicitly deactivating an unstarted Interview releases its
  reservation exactly once. After Start, deletion never returns the pass.
- Stripe fulfillment is webhook-driven and idempotent. Browser success and
  cancellation routes only report server state.

## Domain Invariants

- Interview passes do not expire and are independent of the Interview Model.
- Existing started or submitted Interviews remain usable and are treated as
  consumed without retroactively consuming a pass. Existing unstarted
  Interviews require a reservation before their links can be copied or shared.
- The append-only Pass Ledger explicitly records available, reserved, and
  consumed transitions; a cached Pass Balance distinguishes available and
  reserved counts and is updated in the same transaction.
- Refunds and dispute losses revoke a purchase grant once. If the pass was
  already consumed, the balance may become negative; Interview history is not
  rewritten. Partial refunds are explicitly flagged for reconciliation.
- Stripe Price IDs are allowlisted in server configuration and map to a
  server-owned pass count. Amounts, names, browser input, and arbitrary Stripe
  metadata never authorize fulfillment.

## Verification

The deterministic gate covers introductory grants, existing Creator backfill,
allowlisted purchases, delayed and duplicate webhook fulfillment, signature
failure, concurrent reservation and Start, Client-link gating, deletion and
deactivation reversal,
refund/dispute idempotency, ownership, success-route non-fulfillment, existing
Interview behavior, and English/German UI copy. Provider-boundary fakes
are used; `bun run verify` never contacts Stripe.

## Operations

The sandbox catalog is created or reused separately from application code. The
owner must set the sandbox Price IDs, secret, webhook signing secret, and
return URLs on the matching Convex deployment, enable Managed Payments, confirm
the provisional business-use cloud AIaaS tax code, and register the sandbox
webhook before testing. Live catalog and webhook setup is a separately approved
go-live action.

## Comments

- 2026-08-02: Implemented as a new monetization feature because the original
  template-driven specification explicitly listed monetization as out of
  scope. The original product workflow remains unchanged after Start.
