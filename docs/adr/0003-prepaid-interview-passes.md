---
status: accepted
---

# Use prepaid Interview Passes with Stripe Managed Payments

Interview sells a complete started Interview through two tax-exclusive,
one-time EUR packs: one Interview Pass for €29 and five for €99, plus applicable
taxes. Every Creator receives one non-expiring Introductory Pass, including
Creators who existed before monetization.

Creating and editing an Interview is free. The first Creator action that copies
or shares an Interview Link atomically reserves one available pass. The link is
usable for the Client welcome page, previews, and deliberate Start only while
that reservation exists. The Client's deliberate Start atomically converts the
reservation into a consumed pass before billable AI work. Duplicate and
concurrent Start actions have exactly-once effects. Rotating a link transfers
the same reservation. Deleting or explicitly deactivating an unstarted
Interview releases the reservation exactly once; after Start, deletion never
returns the pass.

The append-only Pass Ledger records introductory and purchase grants,
reservation holds, reservation releases, start consumption, purchase refunds,
dispute adjustments, and operator adjustments. A cached account stores separate
available and reserved counts and is updated in the same Convex transaction as
each ledger entry. Stable idempotency keys, the Interview state, and Convex
transaction retries protect the ownership and exactly-once invariants. Stripe
purchases, refunds, disputes, and reversals are linked to internal purchases
and deduplicated by Stripe event IDs; the success page never fulfills a
purchase.

Existing started or submitted Interviews are treated as consumed without a
retroactive debit. Existing unstarted Interviews require a reservation before
their links can be copied or shared.

Subscriptions, usage-based/token billing, per-message or per-image pricing,
Interview-Model pricing, and a 20-pass tier are deliberately excluded. They
would make the price boundary harder to explain and are not needed to sell a
complete Interview. Stripe Managed Payments is used for its hosted merchant,
tax, and managed-fraud path for this digital AI/SaaS product. Paid Radar for
Fraud Teams and custom Radar rules are not enabled initially because Managed
Payments includes fraud handling; the owner can revisit that decision after
operating evidence and Stripe guidance.

The provisional sandbox business-use cloud AIaaS tax code is `txcd_10105002`.
The owner must obtain final Stripe and tax confirmation before live setup.
