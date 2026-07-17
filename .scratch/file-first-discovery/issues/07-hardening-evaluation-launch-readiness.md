# 07 — Hardening, evaluation, and launch readiness

**What to build:** The complete MVP is measurably safe, accessible, multilingual, resilient, and ready for human pilots, with machine-verifiable launch gates and honest separation of credential/human criteria.

**Blocked by:** 06 — Production boundaries and deployment.

**Status:** ready-for-agent

## Authorized public test seams

- End-to-end core-flow scenarios through the public domain service and browser routes.
- Synthetic fixture evaluation runner and machine-readable stage-gate report.
- Authorization, quota, audit, retry, deletion, localization, and accessibility observable boundaries.

## Acceptance criteria

- [ ] Versioned synthetic/de-identified fixtures cover every evaluation scenario named in the specification, including five pilot-shaped flows.
- [ ] Automated stage gates cover factual File Analysis, retrieval, interview behavior, brief safety/traceability, language, state/idempotency, revocation, and deletion.
- [ ] Per-room quotas, throttles, soft 40-turn checkpoint, bounded retries, cost/latency/attempt metadata, and scrubbed audit events fail safely.
- [ ] Adversarial tests cover cross-room isolation, prompt injection, unsupported claims, revoked links, takeover/double-submit, retry idempotency, and cascading deletion.
- [ ] English/German UI, phone/desktop core flow, keyboard operation, screen-reader labels/live regions, focus, reduced motion, and WCAG 2.2 AA interaction/color requirements are verified.
- [ ] Full tests, typecheck, lint, production build, and final two-axis review against the overall baseline pass with no actionable findings.
- [ ] All local tickets and implementation documentation are current; human pilots, live credentials, and production deployment are reported separately.
