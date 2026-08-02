# Domain and append-only Pass Ledger

Status: ready-for-agent
Type: task

Add the Creator Pass Balance, Introductory Pass grant, append-only Pass Ledger,
purchase records, reconciliation capability, and safe refund/dispute/manual
adjustment accounting. Every cached balance mutation must append one stable
idempotent ledger record in the same transaction.

## Comments

- 2026-08-02: Implemented with server-owned pack counts and ownership checks.
- 2026-08-02: Deterministic Convex tests cover introductory idempotency,
  purchase grants, reconciliation, manual adjustments, refunds, and disputes.
