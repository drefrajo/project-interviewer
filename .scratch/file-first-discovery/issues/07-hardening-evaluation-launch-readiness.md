# 07 — Hardening, evaluation, and launch readiness

**What to build:** The complete MVP is measurably safe, accessible, multilingual, resilient, and ready for human pilots, with machine-verifiable launch gates and honest separation of credential/human criteria.

**Blocked by:** 06 — Production boundaries and deployment.

**Status:** resolved

**Starting commit:** `1c1657054d69fa779c8b98a75c49c52279f2c64e`

## Verification

- 157 automated tests pass.
- The 15-fixture executable evaluation passes every stage gate and covers all
  17 required difficult-path scenarios plus five pilot-shaped flows.
- TypeScript, ESLint, local/production builds, production environment
  validation, Convex deployment validation, and `git diff --check` pass.
- Final Spec and Standards reviews against the overall baseline are clean.
- The rendered accessibility runner passes in installed Chrome at 1280×720 and
  390×844 across the complete keyboard-driven core flow.

## Authorized public test seams

- End-to-end core-flow scenarios through the public domain service and browser routes.
- Synthetic fixture evaluation runner and machine-readable stage-gate report.
- Authorization, quota, audit, retry, deletion, localization, and accessibility observable boundaries.

## Acceptance criteria

- [x] Versioned synthetic/de-identified fixtures cover every evaluation scenario named in the specification, including five pilot-shaped flows.
- [x] Automated stage gates cover factual File Analysis, retrieval, interview behavior, brief safety/traceability, language, state/idempotency, revocation, and deletion.
- [x] Per-room quotas, throttles, soft 40-turn checkpoint, bounded retries, cost/latency/attempt metadata, and scrubbed audit events fail safely.
- [x] Adversarial tests cover cross-room isolation, prompt injection, unsupported claims, revoked links, takeover/double-submit, retry idempotency, and cascading deletion.
- [x] English/German UI, phone/desktop core flow, keyboard operation, screen-reader labels/live regions, focus, reduced motion, and WCAG 2.2 AA interaction/color requirements are verified.
- [x] Full tests, typecheck, lint, production build, and final two-axis review against the overall baseline pass with no actionable findings.
- [x] All local tickets and implementation documentation are current; human pilots, live credentials, and production deployment are reported separately.
