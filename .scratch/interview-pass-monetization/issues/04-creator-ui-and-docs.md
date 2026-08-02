# Creator monetization UI, localization, and operational documentation

Status: ready-for-agent
Type: task

Add compact pass balance with available/reserved counts, buy-one/buy-five
actions, reservation and insufficient-balance states, pending/success/failure/
cancellation routes, English/German copy, setup and launch guidance, and the
monetization ADR/spec updates.

## Comments

- 2026-08-02: Implemented without exposing Price IDs, Stripe events, or ledger
  details to normal users.
- 2026-08-02: English/German copy and success-page state tests pass; setup,
  launch, ADR, glossary, and specification documentation are updated.
- 2026-08-02: Merged the Passes section into Settings, placed it above the
  identity settings form, and kept `/billing` as a compatibility redirect to
  the Settings Passes anchor.
- 2026-08-02: Updated Creator copy and documentation for reservation-on-share
  and consumption-on-Start, including explicit reserved balance display.
